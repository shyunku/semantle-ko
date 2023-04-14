import pickle
from datetime import date, datetime

from flask import (
    Flask,
    send_file,
    send_from_directory,
    jsonify,
    render_template
)
from pytz import utc, timezone
import threading
import word2vec
from process_similar import get_nearest

KST = timezone('Asia/Seoul')

NUM_SECRETS = 4650
current_round = 12;
calculating = False
current_max = 0
current_max_rank = -1
tries = 0

lock = threading.Lock()

def write_last():
    with open('last.dat', 'wb') as f:
        # write 3 fields current round, current_max, tries
        pickle.dump((current_round, current_max, current_max_rank, tries), f)


def read_last():
    global current_round
    global current_max
    global current_max_rank
    global tries
    try:
        with open('last.dat', 'rb') as f:
            current_round, current_max, current_max_rank, tries = pickle.load(f)
    except FileNotFoundError:
        print("last.dat not found, starting from ~")
        # current_round = 0

# read
read_last()

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


# @scheduler.scheduled_job(trigger=CronTrigger(hour=1, minute=0, timezone=KST))

def next_stage(prev):
    print("scheduled stuff triggered!")
    global current_round
    global calculating
    global tries
    global current_max
    global current_max_rank
    
    with lock:
        if calculating:
            return
        calculating = True
        current_round = prev + 1
        tries = 0
        current_max = 0
        current_max_rank = -1
        write_last()
    
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


@app.route('/')
def get_index():
    return render_template('index.html', round=current_round % NUM_SECRETS)


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
def get_guess(round: int, word: str):
    # print(app.secrets[round])
    global tries
    global current_max
    global current_max_rank
    global calculating

    with lock:
        if calculating:
            return jsonify({"error": "calculating"}), 404
        tries += 1
    
    if app.secrets[round].lower() == word.lower():
        word = app.secrets[round]
        # correct
        next_stage(round)
    rtn = {"guess": word}

    write_last()

    # check most similar
    if round in app.nearests and word in app.nearests[round]:
        similarity = app.nearests[round][word][1]
        rank = app.nearests[round][word][0]

        with lock:
            if similarity > current_max:
                current_max = similarity
                current_max_rank = rank

        rtn["sim"] = similarity
        rtn["rank"] = rank
        rtn["tries"] = tries
        rtn["max"] = current_max
        rtn["max_rank"] = current_max_rank
    else:
        try:
            similarity = word2vec.similarity(app.secrets[round], word)
            rtn["sim"] = similarity
            rtn["rank"] = "1000위 이상"
            rtn["tries"] = tries

            with lock:
                if similarity > current_max:
                    current_max = similarity

            rtn["max"] = current_max
            rtn["max_rank"] = current_max_rank
        except KeyError:
            return jsonify({"error": "unknown"}), 404
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
