/*
    Copyright (c) 2022, Newsjelly, forked from Semantlich by Johannes Gätjen semantlich.johannesgaetjen.de and Semantle by David Turner <novalis@novalis.org> semantle.novalis.org

    This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
"use strict";

let gameOver = false;
let guesses = [];
let guessed = new Set();
let guessCount = 0;
let model = null;
let numPuzzles = 4650;
const now = Date.now();
const initialDate = new Date("2022-04-01T00:00:00+09:00");
const yesterdayPuzzleNumber = (puzzleNumber + numPuzzles - 1) % numPuzzles;
const storage = window.localStorage;
let chrono_forward = 1;
let prefersDarkColorScheme = false;
// settings
let darkMode = storage.getItem("darkMode") === "true";
let shareGuesses = storage.getItem("shareGuesses") === "false" ? false : true;
let shareTime = storage.getItem("shareTime") === "false" ? false : true;
let shareTopGuess = storage.getItem("shareTopGuess") === "false" ? false : true;

function $(id) {
  if (id.charAt(0) !== "#") return false;
  return document.getElementById(id.substring(1));
}

function share() {
  // We use the stored guesses here, because those are not updated again
  // once you win -- we don't want to include post-win guesses here.
  const text = solveStory(JSON.parse(storage.getItem("guesses")), puzzleNumber);
  const copied = ClipboardJS.copy(text);

  if (copied) {
    gtag("event", "share");
    alert("클립보드로 복사했습니다.");
  } else {
    alert("클립보드에 복사할 수 없습니다.");
  }
}

const words_selected = [];
const cache = {};
let similarityStory = null;
const expo = 20;

function fastInterval(func, period) {
  func();
  return setInterval(func, period);
}

function mlog(base, x) {
  return Math.log(x) / Math.log(base);
}

function guessRow(similarity, oldGuess, percentile, guessNumber, guess) {
  let percentileText = percentile;
  let progress = "";
  let closeClass = "";
  let weird = false;
  if (similarity >= similarityStory.rest * 100 && percentile === "1000위 이상") {
    if (enableNonDictionaryWordDisplay == false && guess == undefined) return "";
    percentileText =
      '<span class="weirdWord">????<span class="tooltiptext">이 단어는 사전에는 없지만, 데이터셋에 포함되어 있으며 1,000위 이내입니다.</span></span>';
    weird = true;
  }
  if (typeof percentile === "number") {
    closeClass = "close";
    percentileText = `<span class="percentile">${percentile}</span>&nbsp;`;
    let bg = "";
    const maxLog = mlog(expo, 1000);
    let logged = percentile > 1000 ? maxLog : mlog(expo, percentile);
    if (percentile == 1) {
      // rainbow gradient
      bg = "one";
    } else if (percentile <= 5) {
      bg = "five";
    } else if (percentile <= 10) {
      bg = "ten";
    } else if (percentile <= 100) {
      bg = "hundred";
    }
    progress = ` <span class="progress-container">
<span class="progress-bar ${bg}" style="width:${((maxLog - logged) * 100) / maxLog}%;">&nbsp;</span>
</span>`;
  }
  let style = "";
  if (oldGuess === guess) {
    style = 'style="color: #f7617a;font-weight: 600;"';
  }
  return `<tr${
    weird ? ' style="opacity: 0.5;"' : ""
  }><td>${guessNumber}</td><td ${style}>${oldGuess}</td><td>${similarity.toFixed(
    2
  )}%</td><td class="${closeClass}">${percentileText}${progress}
</td></tr>`;
}

function getUpdateTimeHours() {
  const midnightUtc = new Date();
  midnightUtc.setUTCHours(24 - 9, 0, 0, 0);
  return midnightUtc.getHours();
}

function solveStory(guesses, puzzleNumber) {
  let guess_count = guesses.length - 1;
  let is_win = storage.getItem("winState") == 1;
  if (is_win) {
    guess_count += 1;
    if (guess_count == 1) {
      return `이럴 수가! 첫번째 추측에서 ${puzzleNumber}번째 꼬맨틀 정답 단어를 맞혔습니다!\nhttps://semantle-ko.newsjel.ly/`;
    }
  }
  if (guess_count == 0) {
    return `${puzzleNumber}번째 꼬맨틀을 시도하지 않고 바로 포기했어요.\nhttps://semantle-ko.newsjel.ly/`;
  }

  let describe = function (similarity, percentile) {
    let out = `${similarity.toFixed(2)}`;
    if (percentile != "1000위 이상") {
      out += ` (순위 ${percentile})`;
    }
    return out;
  };

  let time = storage.getItem("endTime") - storage.getItem("startTime");
  let timeFormatted = new Date(time).toISOString().substr(11, 8).replace(":", "시간").replace(":", "분");
  let timeInfo = `소요 시간: ${timeFormatted}초\n`;
  if (time > 24 * 3600000) {
    timeInfo = "소요 시간: 24시간 이상\n";
  }
  if (!shareTime) {
    timeInfo = "";
  }

  let topGuessMsg = "";
  const topGuesses = guesses.slice();
  if (shareTopGuess) {
    topGuesses.sort(function (a, b) {
      return b[0] - a[0];
    });
    const topGuess = topGuesses[1];
    let [similarity, old_guess, percentile, guess_number] = topGuess;
    topGuessMsg = `최대 유사도: ${describe(similarity, percentile)}\n`;
  }
  let guessCountInfo = "";
  if (shareGuesses) {
    guessCountInfo = `추측 횟수: ${guess_count}\n`;
  }

  if (is_win) {
    return (
      `${puzzleNumber}번째 꼬맨틀을 풀었습니다!\n${guessCountInfo}` +
      `${timeInfo}${topGuessMsg}https://semantle-ko.newsjel.ly/`
    );
  }

  return (
    `저런… ${puzzleNumber}번째 꼬맨틀을 포기했어요..ㅠ\n${guessCountInfo}` +
    `${timeInfo}${topGuessMsg}https://semantle-ko.newsjel.ly/`
  );
}

let Semantle = (function () {
  async function getSimilarityStory(puzzleNumber) {
    const url = "/similarity/" + puzzleNumber;
    const response = await fetch(url);
    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  async function submitGuess(word) {
    if (cache.hasOwnProperty(word)) {
      return cache[word];
    }
    const url = "/guess/" + puzzleNumber + "/" + word;
    const response = await fetch(url);
    gtag("event", "guess", {
      event_category: "game_event",
      event_label: word,
    });
    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  async function getNearby(word) {
    const url = "/nearby/" + word;
    const response = await fetch(url);
    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  async function getYesterday() {
    const url = "/yesterday/" + puzzleNumber;
    try {
      return (await fetch(url)).text();
    } catch (e) {
      return null;
    }
  }

  async function init() {
    let yesterday = await getYesterday();
    $("#yesterday2").innerHTML = `어제의 정답 단어는 <b>"${yesterday}"</b>입니다.`;
    $(
      "#yesterday-nearest1k"
    ).innerHTML = `정답 단어와 비슷한, <a href="/nearest1k/${yesterdayPuzzleNumber}">유사도 기준 상위 1,000개의 단어</a>를 확인할 수 있습니다.`;

    try {
      similarityStory = await getSimilarityStory(puzzleNumber);
      $("#similarity-story").innerHTML = `
            ${puzzleNumber}회차 정답 단어를 맞혀보세요.<br/>
            정답 단어와 가장 유사한 단어의 유사도는 <span style="color: rgb(221, 81, 81);"><b>${(
              similarityStory.top * 100
            ).toFixed(2)}%</b></span> 입니다.<br/>
            10번째로 유사한 단어의 유사도는 ${(similarityStory.top10 * 100).toFixed(2)}%이고,<br/>
            1,000번째로 유사한 단어의 유사도는 ${(similarityStory.rest * 100).toFixed(2)}% 입니다.`;
    } catch {
      // we can live without this in the event that something is broken
    }

    const storagePuzzleNumber = storage.getItem("puzzleNumber");
    if (storagePuzzleNumber != puzzleNumber) {
      storage.removeItem("guesses");
      storage.removeItem("winState");
      storage.removeItem("startTime");
      storage.removeItem("endTime");
      storage.setItem("puzzleNumber", puzzleNumber);
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      prefersDarkColorScheme = true;
    }

    $("#settings-button").addEventListener("click", openSettings);

    document.querySelectorAll(".dialog-underlay, .dialog-close").forEach((el) => {
      el.addEventListener("click", () => {
        document.body.classList.remove("dialog-open", "settings-open");
      });
    });

    document.querySelectorAll(".dialog").forEach((el) => {
      el.addEventListener("click", (event) => {
        // prevents click from propagating to the underlay, which closes the dialog
        event.stopPropagation();
      });
    });

    $("#dark-mode").addEventListener("click", function (event) {
      storage.setItem("darkMode", event.target.checked);
      toggleDarkMode(event.target.checked);
    });

    toggleDarkMode(darkMode);

    $("#share-guesses").addEventListener("click", function (event) {
      storage.setItem("shareGuesses", event.target.checked);
      shareGuesses = event.target.checked;
    });

    $("#share-time").addEventListener("click", function (event) {
      storage.setItem("shareTime", event.target.checked);
      shareTime = event.target.checked;
    });

    $("#share-top-guess").addEventListener("click", function (event) {
      storage.setItem("shareTopGuess", event.target.checked);
      shareTopGuess = event.target.checked;
    });

    $("#dark-mode").checked = darkMode;
    $("#share-guesses").checked = shareGuesses;
    $("#share-time").checked = shareTime;
    $("#share-top-guess").checked = shareTopGuess;

    $("#give-up-btn").addEventListener("click", async function (event) {
      if (!gameOver) {
        if (confirm("정말로 포기하시겠습니까?")) {
          const url = "/giveup/" + puzzleNumber;
          const secret = await (await fetch(url)).text();
          guessed.add(secret);
          guessCount += 1;
          const newEntry = [100, secret, "정답", guessCount];
          guesses.push(newEntry);
          guesses.sort(function (a, b) {
            return b[0] - a[0];
          });
          updateGuesses(guess);
          endGame(false, true);
          gtag("event", "giveup", {
            event_category: "game_event",
            event_label: "giveup",
          });
          gtag("event", "giveup", {
            event_category: "game_event",
            event_label: "guess_count",
            value: guessCount,
          });
        }
      }
    });

    $("#form").addEventListener("submit", async function (event) {
      event.preventDefault();
      $("#error").textContent = "";
      let guess = $("#guess").value.trim().replace("!", "").replace("*", "").replaceAll("/", "");
      if (!guess) {
        return false;
      }

      $("#guess").value = "";

      $("#dummy").focus(); // to fix ios buffer issue
      $("#guess").focus();

      const alreadyExists = cache.hasOwnProperty(guess);
      const guessData = await submitGuess(guess);

      if (guessData == null) {
        $("#error").textContent = `서버가 응답하지 않습니다. 나중에 다시 시도해보세요.`;
        return false;
      }
      if (guessData.error == "unknown") {
        $("#error").textContent = `${guess}은(는) 알 수 없는 단어입니다.`;
        return false;
      }
      if (guessData.error == "calculating") {
        $("#error").textContent = `다음 문제를 준비하는 중입니다. 잠시 후 다시 새로고침해보세요.`;
        return false;
      }

      guess = guessData.guess;
      cache[guess] = guessData;

      let percentile = guessData.rank;
      let similarity = guessData.sim * 100.0;
      let currentMax = guessData.max ?? 0;
      let currentMaxRank = guessData.max_rank ?? -1;
      if (!guessed.has(guess)) {
        if (guessCount == 0) {
          storage.setItem("startTime", Date.now());
        }
        guessCount += 1;
        gtag("event", "nth_guess", {
          event_category: "game_event",
          event_label: guess,
          value: guessCount,
        });
        guessed.add(guess);

        const newEntry = [similarity, guess, percentile, guessCount];
        guesses.push(newEntry);

        if (!gameOver) {
          const stats = getStats();
          stats["totalGuesses"] += 1;
          storage.setItem("stats", JSON.stringify(stats));
        }
      }
      guesses.sort(function (a, b) {
        return b[0] - a[0];
      });

      try {
        if (!alreadyExists) {
          applyMaxSimlarity(currentMax, currentMaxRank);
        }
      } catch (err) {
        console.error(err);
      }

      if (!gameOver) {
        saveGame(-1, -1);
      }

      chrono_forward = 1;

      updateGuesses(guess);

      if (guessData.sim == 1 && !gameOver) {
        endGame(true, true);
        gtag("event", "win", {
          event_category: "game_event",
          event_label: "win",
        });
        gtag("event", "win", {
          event_category: "game_event",
          event_label: "guess_count",
          value: guessCount,
        });
      }
      return false;
    });

    const winState = storage.getItem("winState");
    if (winState != null) {
      guesses = JSON.parse(storage.getItem("guesses"));
      for (let guess of guesses) {
        guessed.add(guess[1]);
      }
      guessCount = guessed.size;
      updateGuesses("");
      if (winState != -1) {
        endGame(winState > 0, false);
      }
    }
  }

  function openSettings() {
    document.body.classList.add("dialog-open", "settings-open");
  }

  function updateGuesses(guess) {
    let inner = `<tr><th id="chronoOrder">#</th><th id="alphaOrder">추측한 단어</th><th id="similarityOrder">유사도</th><th>유사도 순위</th></tr>`;
    /* This is dumb: first we find the most-recent word, and put
           it at the top.  Then we do the rest. */
    for (let entry of guesses) {
      let [similarity, oldGuess, percentile, guessNumber] = entry;
      if (oldGuess == guess) {
        inner += guessRow(similarity, oldGuess, percentile, guessNumber, guess);
      }
    }
    inner += "<tr><td colspan=4><hr></td></tr>";
    for (let entry of guesses) {
      let [similarity, oldGuess, percentile, guessNumber] = entry;
      if (oldGuess != guess) {
        inner += guessRow(similarity, oldGuess, percentile, guessNumber);
      }
    }
    $("#guesses").innerHTML = inner;
    $("#chronoOrder").addEventListener("click", (event) => {
      guesses.sort(function (a, b) {
        return chrono_forward * (a[3] - b[3]);
      });
      chrono_forward *= -1;
      updateGuesses(guess);
    });
    $("#alphaOrder").addEventListener("click", (event) => {
      guesses.sort(function (a, b) {
        return a[1].localeCompare(b[1]);
      });
      chrono_forward = 1;
      updateGuesses(guess);
    });
    $("#similarityOrder").addEventListener("click", (event) => {
      guesses.sort(function (a, b) {
        return b[0] - a[0];
      });
      chrono_forward = 1;
      updateGuesses(guess);
    });
    const found = guesses.reduce((acc, cur) => {
      return acc + (typeof cur[2] == "number" ? 1 : 0);
    }, 0);
    $(
      "#found"
    ).innerHTML = `<span style="font-size: 0.8em;">상위 1000개 단어 중 <b>${found}개</b>를 찾았습니다.</span>`;
  }

  function toggleDarkMode(on) {
    document.body.classList[on ? "add" : "remove"]("dark");
    const darkModeCheckbox = $("#dark-mode");
    darkMode = on;
    // this runs before the DOM is ready, so we need to check
    if (darkModeCheckbox) {
      darkModeCheckbox.checked = on;
    }
  }

  function checkMedia() {
    let darkMode = storage.getItem("darkMode") === "true";
    toggleDarkMode(darkMode);
  }

  function setSnowMode() {
    let days = Math.floor(Date.now() / 1000 / 60 / 60 / 24);
    let on = days % 3 === 0;
    document.body.classList[on ? "add" : "remove"]("snow");
  }

  function saveGame(guessCount, winState) {
    // If we are in a tab still open from yesterday, we're done here.
    // Don't save anything because we may overwrite today's game!
    let savedPuzzleNumber = storage.getItem("puzzleNumber");
    if (savedPuzzleNumber != puzzleNumber) {
      return;
    }

    storage.setItem("winState", winState);
    storage.setItem("guesses", JSON.stringify(guesses));
  }

  function getStats() {
    const oldStats = storage.getItem("stats");
    if (oldStats == null) {
      const stats = {
        firstPlay: puzzleNumber,
        lastEnd: puzzleNumber - 1,
        lastPlay: puzzleNumber,
        winStreak: 0,
        playStreak: 0,
        totalGuesses: 0,
        wins: 0,
        giveups: 0,
        abandons: 0,
        totalPlays: 0,
      };
      storage.setItem("stats", JSON.stringify(stats));
      return stats;
    } else {
      const stats = JSON.parse(oldStats);
      if (stats["lastPlay"] != puzzleNumber) {
        const onStreak = stats["lastPlay"] == puzzleNumber - 1;
        if (onStreak) {
          stats["playStreak"] += 1;
        }
        stats["totalPlays"] += 1;
        if (stats["lastEnd"] != puzzleNumber - 1) {
          stats["abandons"] += 1;
        }
        stats["lastPlay"] = puzzleNumber;
      }
      return stats;
    }
  }

  function endGame(won, countStats) {
    let stats = getStats();
    if (storage.getItem("endTime") == null) {
      storage.setItem("endTime", Date.now());
    }
    if (countStats) {
      const onStreak = stats["lastEnd"] == puzzleNumber - 1;

      stats["lastEnd"] = puzzleNumber;
      if (won) {
        if (onStreak) {
          stats["winStreak"] += 1;
        } else {
          stats["winStreak"] = 1;
        }
        stats["wins"] += 1;
      } else {
        stats["winStreak"] = 0;
        stats["giveups"] += 1;
      }
      storage.setItem("stats", JSON.stringify(stats));
    }

    $("#give-up-btn").style = "display:none;";
    $("#response").classList.add("gaveup");
    gameOver = true;
    let response;
    if (won) {
      response = `<p><b>정답 단어를 맞혔습니다. ${guesses.length}번째 추측만에 정답을 맞혔네요!</b><br/>`;
    } else {
      response = `<p><b>${guesses.length - 1}번째 추측에서 포기했습니다!</b><br/>`;
    }
    const commonResponse = `정답 단어와 비슷한, <a href="/nearest1k/${puzzleNumber}">상위 1,000개의 단어</a>를 확인해보세요.</p>`;
    response += commonResponse;
    response += `<input type="button" value="기록 복사하기" id="result" onclick="share()" class="button"><br />`;
    const totalGames = stats["wins"] + stats["giveups"] + stats["abandons"];
    response += `<br/>
        ${puzzleNumber + 1}회차 문제는 새로고침 후 확인하실 수 있습니다.<br/>
<br/>
<b>나의 플레이 기록</b>: <br/>
<table>
<tr><th>가장 처음 풀었던 문제:</th><td>${stats["firstPlay"]}</td></tr>
<tr><th>도전한 게임 횟수:</th><td>${totalGames}</td></tr>
<tr><th>정답 횟수:</th><td>${stats["wins"]}</td></tr>
<tr><th>연속 정답 횟수:</th><td>${stats["winStreak"]}</td></tr>
<tr><th>포기 횟수:</th><td>${stats["giveups"]}</td></tr>
<tr><th>지금까지 추측 단어 총 갯수:</th><td>${stats["totalGuesses"]}</td></tr>
</table>
`;
    $("#response").innerHTML = response;

    if (countStats) {
      saveGame(guesses.length, won ? 1 : 0);
    }
  }

  function applyMaxSimlarity(currentMax, currentMaxRank) {
    let color;
    if (currentMaxRank != -1) {
      if (currentMaxRank <= 5) color = `color: rgb(221, 81, 81)`;
      else if (currentMaxRank <= 10) color = `color: rgb(217, 189, 69)`;
      else if (currentMaxRank <= 100) color = `color: rgb(92, 171, 85)`;
      else color = `color: #00b5ef`;
    }
    $("#max-similarity").innerHTML = `<span style="font-weight: bold; ${color}">${(currentMax * 100).toFixed(2)}% ${
      currentMax == 1 ? "" : `(${currentMaxRank == -1 ? "1000위 이상" : `${currentMaxRank}위`})`
    }</span>`;
  }

  function applyWastedTime(wastedTime) {
    $("#wasted-time").innerHTML = `${fromRelativeTime(wastedTime * 1000)}`;
    let color = "";
    if (wastedTime < 60 * 30) {
      color = `color: #00b5ef`;
    } else if (wastedTime < 60 * 60) {
      color = `color: rgb(92, 171, 85)`;
    } else if (wastedTime < 60 * 60 * 3) {
      color = `color: rgb(217, 189, 69)`;
    } else if (wastedTime < 60 * 60 * 12) {
      color = `color: rgb(221, 81, 81)`;
    } else {
      color = `color: rgb(255, 0, 0)`;
    }
    $("#wasted-time").style = color;
  }

  function applyTries(tries) {
    $("#total-tries").innerHTML = `${tries} 회`;
  }

  function applyEnableNonDictionaryWordDisplay(enable) {
    localStorage.setItem("enableNonDictionaryWordDisplay", enable);
    $("#enable-non-dictionary-word-display").checked = enable;
    enableNonDictionaryWordDisplay = enable;
    updateGuesses("");
  }

  function updateLastTime() {
    if (startTime == null) return;
    const diff = parseInt((Date.now() - startTime * 1000) / 1000);
    if (diff < 0) return;
    let color;
    if (diff < 60 * 30) color = `color: #00b5ef`;
    else if (diff < 60 * 60 * 3) color = `color: rgb(92, 171, 85)`;
    else if (diff < 60 * 60 * 24) color = `color: rgb(217, 189, 69)`;
    else if (diff < 60 * 60 * 24 * 3) color = `color: rgb(221, 81, 81)`;
    else color = `color: red`;
    $("#current-proc-time").innerHTML = `<span style="${color}">${fromRelativeTime(diff * 1000)}</span>`;
  }

  function applySocketStatus(status) {
    switch (status) {
      case 0:
        $("#socket-status").innerHTML = "연결 끊김";
        $("#socket-status").style.color = `#ff0000`;
        break;
      case 1:
        $("#socket-status").innerHTML = "연결 중...";
        $("#socket-status").style.color = `#aaaa00`;
        break;
      case 2:
        $("#socket-status").innerHTML = "연결됨";
        $("#socket-status").style.color = `#00ff00`;
        break;
    }
    console.log("Socket status changed to", status);
  }

  function connect() {
    const handlers = {};
    const onHandlers = {};
    let pingThread = null;

    applySocketStatus(1);
    const socket = new WebSocket("ws://43.200.219.71:3998");

    let sendSync = (type, data) => {
      if (!socket.OPEN) {
        console.error("Socket is not open yet");
        return;
      }

      const reqId = randomUUID();
      return new Promise((resolve, reject) => {
        handlers[reqId] = resolve;
        socket.send(JSON.stringify({ type, data, reqId }));
      });
    };

    let on = (type, handler) => {
      onHandlers[type] = handler;
    };

    socket.onopen = function (e) {
      console.log("[open] Connection established");
      applySocketStatus(2);

      pingThread = fastInterval(async () => {
        let data = await sendSync("ping", Date.now());
        const diff = Date.now() - data;
        $("#ping-status").innerHTML = `${diff}`;
      }, 2000);

      (async () => {
        let currentTries = await sendSync("tries");
        applyTries(currentTries);
      })();

      (async () => {
        let maxSimRank = await sendSync("maxSimRank");
        applyMaxSimlarity(maxSimRank.max, maxSimRank.max_rank);
      })();

      (async () => {
        let wastedTime = await sendSync("wasted_time");
        applyWastedTime(wastedTime);
      })();
    };

    socket.onmessage = function (event) {
      const raw = JSON.parse(event.data);
      const { type, data } = raw;
      const reqId = raw.reqId ?? null;

      console.debug(`[message] Data received from server: ${type} ${data}`);
      if (handlers.hasOwnProperty(reqId)) {
        handlers[reqId](data);
        delete handlers[reqId];
      } else if (reqId == null && onHandlers.hasOwnProperty(type)) {
        onHandlers[type](data);
      } else {
        console.error("No handler for request id", reqId);
      }
    };

    socket.onclose = function (event) {
      console.log("[close] Connection closed");
      clearInterval(pingThread);
      applySocketStatus(0);

      // retry
      setTimeout(() => {
        connect();
      }, 5000);
    };

    on("client_count", (data) => {
      $("#current-user-counts").innerHTML = `${data ?? 0} 명`;
    });

    on("tries", (data) => {
      applyTries(data);
    });

    on("maxSimRank", (data) => {
      applyMaxSimlarity(data.max, data.max_rank);
    });

    on("wasted_time", (data) => {
      applyWastedTime(data);
    });

    on("new_round", (r) => {
      if (puzzleNumber == r) {
        alert("누군가가 문제를 풀었습니다. 새로고침을 해주세요.");
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    // update with start time
    const f1 = fastInterval(() => {
      updateLastTime();
    }, 1000);

    applyEnableNonDictionaryWordDisplay(enableNonDictionaryWordDisplay);

    $("#enable-non-dictionary-word-display").addEventListener("change", (e) => {
      applyEnableNonDictionaryWordDisplay(e.target.checked);
    });

    connect();
  });

  return {
    init: init,
    checkMedia: checkMedia,
    setSnowMode: setSnowMode,
  };
})();

// do this when the file loads instead of waiting for DOM to be ready to avoid
// a flash of unstyled content
Semantle.checkMedia();
// Semantle.setSnowMode();

window.addEventListener("load", async () => {
  Semantle.init();
});
