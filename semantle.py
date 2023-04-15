import pickle
from util import *
from datetime import date, datetime

from flask import (
    Flask,
    send_file,
    send_from_directory,
    jsonify,
    render_template,
    request,
)
from pytz import utc, timezone
import threading
import word2vec
from process_similar import get_nearest
from functools import wraps
import asyncio
import websockets
import json

KST = timezone('Asia/Seoul')

# websocket
# websocket
connected_clients = set()

async def broadcast(type, data):
    global connected_clients
    for client in connected_clients:
        try:
            await client.send(json.dumps({
                "type": type,
                "data": data
            }))
        except Exception as e:
            # do nothing
            continue


VERSION = "1.1.35"
NUM_SECRETS = 4650
current_round = 41;
calculating = False
current_max = 0
current_max_rank = -1
tries = 0
wasted_time = 0
last_time = now()

lock = threading.Lock()

def write_last():
    with open('last.dat', 'w') as f:
        # write 3 fields current round, current_max, tries
        # write as json data
        global current_round
        global current_max
        global current_max_rank
        global tries
        global last_time
        global wasted_time

        data = {
            "current_round": current_round,
            "current_max": current_max,
            "current_max_rank": current_max_rank,
            "tries": tries,
            "last_time": last_time,
            "wasted_time": wasted_time
        }
        json.dump(data, f)


def read_last():
    global current_round
    global current_max
    global current_max_rank
    global tries
    global last_time
    global wasted_time

    try:
        with open('last.dat', 'r') as f:
            # read with json
            try:
                loaded = json.load(f)
            except json.decoder.JSONDecodeError:
                print("last.dat is not json")
                return
        
            try:
                current_round = loaded["current_round"]
            except KeyError:
                print("last.dat does not have current_round")
            try:
                current_max = loaded["current_max"]
            except KeyError:
                print("last.dat does not have current_max")
            try:
                current_max_rank = loaded["current_max_rank"]
            except KeyError:
                print("last.dat does not have current_max_rank")
            try:
                tries = loaded["tries"]
            except KeyError:
                print("last.dat does not have tries")
            try:
                last_time = loaded["last_time"]
            except KeyError:
                print("last.dat does not have last_time")
            try:
                wasted_time = loaded["wasted_time"]
            except KeyError:
                print("last.dat does not have wasted_time")

    except FileNotFoundError:
        print("last.dat not found, starting from ~")
        # current_round = 0


# read
read_last()

print("opening flask server")
app = Flask(__name__)
print("loading valid nearest")
with open('data/valid_nearest.dat', 'rb') as f:
    valid_nearest_words, valid_nearest_vecs = pickle.load(f)
with open('data/secrets.txt', 'r', encoding='utf-8') as f:
    secrets = [l.strip() for l in f.readlines()]
print("initializing nearest words for solutions")
app.secrets = dict()
app.nearests = dict()
current_puzzle = current_round % NUM_SECRETS
for offset in range(-2, 2):
    puzzle_number = (current_puzzle + offset) % NUM_SECRETS
    secret_word = secrets[puzzle_number]
    app.secrets[puzzle_number] = secret_word
    app.nearests[puzzle_number] = get_nearest(puzzle_number, secret_word, valid_nearest_words, valid_nearest_vecs)
    print(f"initialized {puzzle_number} round")

# Flask 앱 생성 후에 추가

def async_action(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))
    return wrapped

async def next_stage(prev):
    print(f"scheduled stuff triggered: problem {prev + 1}")
    global current_round
    global calculating
    global tries
    global current_max
    global current_max_rank
    global last_time
    global wasted_time
    
    with lock:
        if calculating:
            return
        calculating = True
        current_round = prev + 1
        tries = 0
        current_max = 0
        current_max_rank = -1
        last_time = now()
        wasted_time = 0
        write_last()
    
    await broadcast("new_round", current_round)
    
    next_puzzle = current_round % NUM_SECRETS
    next_word = secrets[next_puzzle]
    to_delete = (next_puzzle - 4) % NUM_SECRETS
    if to_delete in app.secrets:
        del app.secrets[to_delete]
    if to_delete in app.nearests:
        del app.nearests[to_delete]
    app.secrets[next_puzzle] = next_word
    app.nearests[next_puzzle] = get_nearest(next_puzzle, next_word, valid_nearest_words, valid_nearest_vecs)

    with lock:
        calculating = False


def update_nearest():
    next_stage(current_round)

@app.before_request
def before_request():
    print(f"[{datetime.now(utc).strftime('%Y.%m.%d %H:%M:%S')}] {request.remote_addr} {request.method} {request.path}")

@app.after_request
def after_request(response):
    print(f"[{datetime.now(utc).strftime('%Y.%m.%d %H:%M:%S')}] status {response.status_code}")
    return response

@app.route('/')
def get_index():
    global current_round
    rendered = render_template('index.html', round=current_round % NUM_SECRETS, last_time=last_time, version=VERSION)
    return rendered


@app.route('/robots.txt')
def robots():
    return send_file("static/assets/robots.txt")


@app.route("/favicon.ico")
def send_favicon():
    return send_file("static/assets/favicon.ico")


@app.route("/assets/<path:path>")
def send_static(path):
    return send_from_directory("static/assets", path)


@app.route('/guess/<int:round>/<string:word>')
@async_action
async def get_guess(round: int, word: str):
    # print(app.secrets[round])
    global tries
    global current_max
    global current_max_rank
    global calculating
    global current_round

    with lock:
        if calculating:
            return jsonify({"error": "calculating"}), 404
        tries += 1

    if round != current_round:
        return jsonify({"error": "wrong round"}), 404
    
    await broadcast("tries", tries)
    
    correct = False
    if app.secrets[round].lower() == word.lower():
        word = app.secrets[round]
        correct = True
    elif current_max == 1:
        current_max = 0
    rtn = {"guess": word}

    write_last()

    # print("guess", word, "correct", correct, "round", round, "tries", tries, "max", current_max, "max_rank", current_max_rank)

    # check most similar
    if round in app.nearests and word in app.nearests[round]:
        similarity = app.nearests[round][word][1]
        rank = app.nearests[round][word][0]

        with lock:
            if similarity > current_max:
                current_max = similarity
                if current_max == 1:
                    current_max_rank = 0
                else:
                    current_max_rank = rank

        rtn["sim"] = similarity
        rtn["rank"] = rank
        rtn["max"] = current_max
        rtn["max_rank"] = current_max_rank

        await broadcast("otherHint", {
            "word": word,
            "similarity": similarity,
            "rank": rank
        })
    else:
        try:
            similarity = word2vec.similarity(app.secrets[round], word)
            rtn["sim"] = similarity
            rtn["rank"] = "1000위 이상"

            if similarity > current_max:
                current_max = similarity

            rtn["max"] = current_max
            rtn["max_rank"] = current_max_rank

            await broadcast("otherHint", {
                "word": word,
                "similarity": similarity,
                "rank": -1
            })
        except KeyError:
            return jsonify({"error": "unknown"}), 404
    
    await broadcast("maxSimRank", {
        "max": current_max,
        "max_rank": current_max_rank
    })
    
    if correct:
        await next_stage(round)
        
    return jsonify(rtn)


@app.route('/similarity/<int:round>')
def get_similarity(round: int):
    nearest_dists = sorted([v[1] for v in app.nearests[round].values()])
    return jsonify({"top": nearest_dists[-2], "top10": nearest_dists[-11], "rest": nearest_dists[0]})


@app.route('/yesterday/<int:round>')
def get_solution_yesterday(round: int):
    return app.secrets[(round - 1) % NUM_SECRETS]

@app.route('/answer-secured')
def get_solution():
    return app.secrets[current_round % NUM_SECRETS]


@app.route('/nearest1k/<int:round>')
def get_nearest_1k(round: int):
    global current_round
    if round >= current_round:
        return jsonify({"error": "future"}), 404
    if round not in app.secrets:
        return "이 날의 가장 유사한 단어는 현재 사용할 수 없습니다. 그저께부터 내일까지만 확인할 수 있습니다.", 404
    solution = app.secrets[round]
    words = [
        dict(
            word=w,
            rank=k[0],
            similarity="%0.2f" % (k[1] * 100))
        for w, k in app.nearests[round].items() if w != solution]
    return render_template('top1k.html', word=solution, words=words, round=round)


@app.route('/giveup/<int:round>')
def give_up(round: int):
    if round not in app.secrets:
        return '저런...', 404
    else:
        return app.secrets[round]


print("Server setup done.")

# count like setInterval
async def count_wasted_time():
    global wasted_time
    global connected_clients

    while True:
        await asyncio.sleep(1)
        wasted_time += len(connected_clients)
        await broadcast("wasted_time", wasted_time)
        write_last()

def start_counter():
    asyncio.run(count_wasted_time())

count_wasted_time_thread = threading.Thread(target=start_counter, daemon=True)
count_wasted_time_thread.start()

# websocket server
async def echo(websocket, path):
    global connected_clients
    connected_clients.add(websocket)
    await broadcast("client_count", len(connected_clients))

    try:
        async for message in websocket:
            # 클라이언트로부터 메시지를 받았을 때의 처리 로직
            # print(f"Received message: {message}")

            global tries
            global current_max
            global current_max_rank
            global wasted_time

            # parse as json
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                print("Invalid json")
                continue

            # read json
            if "type" not in data:
                print("Invalid json")
                continue
            if "reqId" not in data:
                print("Invalid json")
                continue

            reqId = data["reqId"]
            type = data["type"]
            try:
                req_data = data["data"]
            except KeyError:
                req_data = None
            
            if type == "ping":
                res_data = req_data
            elif type == "tries":
                res_data = tries
            elif type == "maxSimRank":
                res_data = {
                    "max": current_max,
                    "max_rank": current_max_rank
                }
            elif type == "wasted_time":
                res_data = wasted_time
            
            # create response with json
            response = {
                "type": type,
                "reqId": reqId,
                "data": res_data
            }

            response_json = json.dumps(response)
            await websocket.send(response_json)
    except Exception as e:
        print(e)
    finally:
        connected_clients.remove(websocket)
        await broadcast("client_count", len(connected_clients))

async def start_server():
    server = await websockets.serve(echo, "0.0.0.0", 3998)
    await server.wait_closed()

def run_websocket_server():
    asyncio.run(start_server())

# 별도의 스레드에서 웹소켓 서버를 실행합니다.
websocket_server_thread = threading.Thread(target=run_websocket_server, daemon=True)
websocket_server_thread.start()