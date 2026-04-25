//proof of concept/testing purposes only

const MitigationController = require('./mitigation.js');

const mc = new MitigationController();


// test sigmoid
console.log("sigmoid(0) should be 0.5:", mc.sigmoid(0));

// test computePHA float scale
console.log("Pick Lock p(H|A) should be ~0.49:", mc.computePHA(0.4, 0.2, 0.4));

// test computePHA INT scale with equal weights
console.log("X1 (equal weights):", mc.computePHA(4, 2, 2, 1/3, 1/3, 1/3, "INT"));
console.log("X15 (equal weights):", mc.computePHA(5, 1, 1, 1/3, 1/3, 1/3, "INT"));
console.log("X9 (equal weights):", mc.computePHA(1, 2, 4, 1/3, 1/3, 1/3, "INT"));


console.log("normalize equal weights:", mc.normalizeWeights(1, 1, 1));
console.log("normalize navya weights:", mc.normalizeWeights(0.6, 0.6, 0.8));
console.log("normalize paper weights:", mc.normalizeWeights(3, 2, 4));

try {
    mc.normalizeWeights(0, 1, 1);
} catch(e) {
    console.log("caught error for 0 weight:", e.message);
}

try {
    mc.normalizeWeights(-1, 1, 1);
} catch(e) {
    console.log("caught error for negative weight:", e.message);
}


// test new CSV format
let testCSV = "scale,w_ac,w_td,w_dd\nINT,1,1,1\nnode_name,AC_new,TD_new,DD_new\nPick Lock,0.8,0.6,0.2";
let csvResult = mc.parseMitigationCSV(testCSV);
console.log("parseMitigationCSV result:", csvResult);


let testTree = {
    name: "Open Safe",
    operator: "OR",
    children: [
        {name: "Pick Lock", a: "0.4", t: "0.2", d: "0.4"},
        {name: "Cut Open Safe", a: "0.8", t: "0.8", d: "0.2"}
    ]
};

// test applyMitigation
let testNode = {a: "0.4", t: "0.2", d: "0.4"};
let testMitigation = {AC_new: 0.9, TD_new: 0.6, DD_new: 0.2};
console.log("applyMitigation result:", mc.applyMitigation(testNode, testMitigation, "FLOAT"));

// test analyzeMitigations using csv result
console.log("analyzeMitigations result:", mc.analyzeMitigations(
    testTree,
    csvResult.mitigations,
    csvResult.scale,
    csvResult.weights.w_ac,
    csvResult.weights.w_td,
    csvResult.weights.w_dd
));

// test computeTreeProbability FLOAT
console.log("Tree probability (FLOAT):", mc.computeTreeProbability(testTree));

// test computeTreeProbability INT
let intTree = {
    name: "Election Interference",
    operator: "OR",
    children: [
        {name: "Voter DB Breach", a: "3", t: "3", d: "3"},
        {name: "Ballot Tampering", a: "3", t: "4", d: "2"}
    ]
};
console.log("Tree probability (INT):", mc.computeTreeProbability(intTree, "INT"));

// test AND node
let andTree = {
    name: "Eavesdrop",
    operator: "AND",
    children: [
        {name: "Listen to conversation", a: "0.8", t: "0.4", d: "0.4"},
        {name: "Get target to say combination", a: "0.8", t: "0.6", d: "0.4"}
    ]
};
console.log("AND tree probability:", mc.computeTreeProbability(andTree));

// test real election tree slice
let realTreeSlice = {
    name: "Edit During Duplication",
    operator: "AND",
    children: [
        {name: "Form Collaboration of PWs", a: "4", t: "2", d: "2"},
        {name: "Gain Exclusive Access to Ballots", a: "4", t: "3", d: "2"},
        {name: "Mark under/over votes or changes votes", a: "3", t: "4", d: "2"}
    ]
};
console.log("Branch 1.1.1.1 AND probability:", mc.computeTreeProbability(realTreeSlice, "INT"));

// test computeDeltaLikelihood using csv result
let deltaResult = mc.computeDeltaLikelihood(
    testTree,
    csvResult.mitigations,
    csvResult.scale,
    csvResult.weights.w_ac,
    csvResult.weights.w_td,
    csvResult.weights.w_dd
);
console.log("Delta likelihood result:", deltaResult);

// test INT csv
let intCSV = "scale,w_ac,w_td,w_dd\nINT,1,1,1\nnode_name,AC_new,TD_new,DD_new\nVoter DB Breach,5,4,3";
let intCsvResult = mc.parseMitigationCSV(intCSV);
let intDeltaResult = mc.computeDeltaLikelihood(
    intTree,
    intCsvResult.mitigations,
    intCsvResult.scale,
    intCsvResult.weights.w_ac,
    intCsvResult.weights.w_td,
    intCsvResult.weights.w_dd
);
console.log("Delta likelihood result (INT):", intDeltaResult);


// test runMitigationAnalysis
let fullCSV = "scale,w_ac,w_td,w_dd\nINT,1,1,1\nnode_name,AC_new,TD_new,DD_new\nForm Collaboration of PWs,5,3,2\nGain Exclusive Access to Ballots,5,4,2\nMark under/over votes or changes votes,4,5,2";

let fullResult = mc.runMitigationAnalysis(realTreeSlice, fullCSV);
console.log("runMitigationAnalysis result:", JSON.stringify(fullResult, null, 2));

// fix 1 - test case insensitive matching
let caseTestTree = {
    name: "Test",
    operator: "OR",
    children: [
        {name: "Form Collaboration of PWs", a: "4", t: "2", d: "2"}
    ]
};
let caseTestCSV = "scale,w_ac,w_td,w_dd\nINT,1,1,1\nnode_name,AC_new,TD_new,DD_new\nform collaboration of pws,5,3,2";
let caseResult = mc.runMitigationAnalysis(caseTestTree, caseTestCSV);
console.log("Fix 1 - case insensitive match:", caseResult.nodeResults.length > 0 ? "PASSED" : "FAILED");

// fix 2 - test mitigation direction warning
let directionNode = {name: "Test Node", a: "3", t: "3", d: "3"};
let badMitigation = {AC_new: 2, TD_new: 4, DD_new: 4}; // AC decreased, DD increased
let warnings = mc.validateMitigationDirection(directionNode, badMitigation);
console.log("Fix 2 - direction warnings:", warnings.length === 2 ? "PASSED" : "FAILED");
console.log("Warnings:", warnings);

// fix 3 - test windows line endings
let windowsCSV = "scale,w_ac,w_td,w_dd\r\nINT,1,1,1\r\nnode_name,AC_new,TD_new,DD_new\r\nForm Collaboration of PWs,5,3,2";
let windowsResult = mc.parseMitigationCSV(windowsCSV);
console.log("Fix 3 - windows line endings:", windowsResult.mitigations.length > 0 ? "PASSED" : "FAILED");

// fix 4 - test missing values
let missingNode = {name: "Missing Values Node", operator: "OR", children: [
    {name: "No Metrics Node"}
]};
console.log("Fix 4 - missing values warning test:");
mc.computeTreeProbability(missingNode, "INT");

// test computeBranchResults
let branchResults = mc.runMitigationAnalysis(realTreeSlice, fullCSV);
console.log("Branch results:", JSON.stringify(branchResults.branchResults, null, 2));

// test computeBranchResults with a tree that has branches
let branchTree = {
    name: "Root",
    operator: "OR",
    children: [
        {
            name: "Branch 1",
            operator: "OR",
            children: [
                {name: "Form Collaboration of PWs", a: "4", t: "2", d: "2"},
                {name: "Gain Exclusive Access to Ballots", a: "4", t: "3", d: "2"}
            ]
        },
        {
            name: "Branch 2",
            operator: "OR",
            children: [
                {name: "Mark under/over votes or changes votes", a: "3", t: "4", d: "2"}
            ]
        }
    ]
};

let branchFullResult = mc.runMitigationAnalysis(branchTree, fullCSV);
console.log("Branch results:", JSON.stringify(branchFullResult.branchResults, null, 2));