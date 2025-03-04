const YEAR = 365 * 24 * 60 * 60 * 1000;
const MONTH = 30 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const SECOND = 1000;

// relative time to relative time text
const defaultOptions = {
  showLayerCount: 4,
  showMillisec: false,
};

function fromRelativeTime(milli, rawOptions = defaultOptions) {
  if (milli == null) return "-";
  let inversed = milli < 0;
  if (inversed) milli = -milli;

  const options = { ...defaultOptions, ...rawOptions };

  const year = Math.floor(milli / YEAR);
  milli %= YEAR;
  const month = Math.floor(milli / MONTH);
  milli %= MONTH;
  const day = Math.floor(milli / DAY);
  milli %= DAY;
  const hour = Math.floor(milli / HOUR);
  milli %= HOUR;
  const min = Math.floor(milli / MINUTE);
  milli %= MINUTE;
  const sec = Math.floor(milli / SECOND);
  milli %= SECOND;
  const msec = milli;

  const segments = [
    { value: year, unit: "년" },
    { value: month, unit: "개월" },
    { value: day, unit: "일" },
    { value: hour, unit: "시간" },
    { value: min, unit: "분" },
    { value: sec, unit: "초" },
    { value: msec, unit: "밀리초" },
  ];

  const showLayerCount = options?.showLayerCount ?? 0;

  const texts = [];
  let flag = false;
  for (let i = 0, j = 0; i < segments.length; i++) {
    const { value, unit } = segments[i];
    if (options?.showMillisec === false && unit === "밀리초") continue;
    if (value > 0 || flag) {
      let valText = unit === "밀리초" ? value.toString().padStart(3, "0") : value;
      texts.push(`${valText}${unit}`);
      j++;
      flag = true;
    }
    if (showLayerCount && j >= showLayerCount) break;
  }
  if (texts.length === 0) texts.push("0초");

  return (inversed ? "-" : "") + texts.join(" ");
}

function randomUUID() {
  // Public Domain/MIT
  var d = new Date().getTime();
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    d += performance.now(); //use high-precision timer if available
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getWastedTimeColor(wastedTime) {
  if (wastedTime < 60 * 30) {
    return `#00b5ef`;
  } else if (wastedTime < 60 * 60) {
    return `rgb(92, 171, 85)`;
  } else if (wastedTime < 60 * 60 * 3) {
    return `rgb(217, 189, 69)`;
  } else if (wastedTime < 60 * 60 * 12) {
    return `rgb(221, 81, 81)`;
  } else {
    return `rgb(255, 0, 0)`;
  }
}

function getSimRankColor(rank) {
  if (rank == -1) return null;
  if (rank <= 5) return `rgb(221, 81, 81)`;
  else if (rank <= 10) return `rgb(217, 189, 69)`;
  else if (rank <= 100) return `rgb(92, 171, 85)`;
  else return `#00b5ef`;
}
