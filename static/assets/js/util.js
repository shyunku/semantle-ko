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
