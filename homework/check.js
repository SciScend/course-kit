"use strict";
// Helper for the practice tasks - you do not need to change or understand it yet.
// check("what is checked", actualValue, expectedValue) prints OK or FAIL.
// After the last check, the process prints "N of M checks passed" on exit and
// exits with code 1 if any check failed.
let total = 0;
let passed = 0;

function check(label, actual, expected) {
    const same = actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
    total++;
    if (same) {
        passed++;
        console.log("OK   " + label);
    } else {
        console.log("FAIL " + label + ": got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected));
        process.exitCode = 1;
    }
}

process.on("exit", () => {
    if (total > 0) console.log(passed + " of " + total + " checks passed");
});

module.exports = check;
