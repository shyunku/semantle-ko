let rawENDWD = localStorage.getItem("enableNonDictionaryWordDisplay");

let puzzleNumber = -1;
let startTime = null;
let enableNonDictionaryWordDisplay = rawENDWD != null ? rawENDWD == "true" : true;
