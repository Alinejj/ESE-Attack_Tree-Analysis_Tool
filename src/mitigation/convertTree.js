const fs = require('fs');

const csvText = fs.readFileSync('src/mitigation/electionTree.csv', 'utf8');
const lines = csvText.replace(/\r/g, '').split('\n');

const dataLines = lines.slice(1);

const nodeMap = new Map();

dataLines.forEach(line => {
    if(line.trim() === '') return;
    const parts = [];
    let current = '';
    let inQuotes = false;
    for(let i = 0; i < line.length; i++){
        if(line[i] === '"') {
            inQuotes = !inQuotes;
        } else if(line[i] === ',' && !inQuotes){
            parts.push(current.trim());
            current = '';
        } else {
            current += line[i];
        }
    }
    parts.push(current.trim());
    
    const index = parts[0].trim();
    const nodeType = parts[1].trim();
    const outlineNumber = parts[2].trim();
    const threatDescription = parts[3].trim();
    const AC = parts[4] ? parts[4].trim() : '';
    const TD = parts[5] ? parts[5].trim() : '';
    const DD = parts[6] ? parts[6].trim() : '';

    let node = {
        name: threatDescription,
        outlineNumber: outlineNumber
    };

    if(nodeType === 'T'){
        // leaf node
        if(AC) node.a = AC;
        if(TD) node.t = TD;
        if(DD) node.d = DD;
    } else if(nodeType === 'O'){
        node.operator = 'OR';
        node.children = [];
    } else if(nodeType === 'A'){
        node.operator = 'AND';
        node.children = [];
    }

    nodeMap.set(outlineNumber, node);
});

// build tree by linking children to parents
const roots = [];
nodeMap.forEach((node, outlineNumber) => {
    const parts = outlineNumber.split('.');
    if(parts.length === 1){
        roots.push(node);
    } else {
        const parentOutline = parts.slice(0, -1).join('.');
        const parent = nodeMap.get(parentOutline);
        if(parent && parent.children){
            parent.children.push(node);
        }
    }
});

const cleanNode = (node) => {
    delete node.outlineNumber;
    if(node.children){
        node.children.forEach(cleanNode);
    }
    return node;
};

roots.forEach(cleanNode);

const tree = roots.length === 1 ? roots[0] : { name: "Election Attack Tree", operator: "OR", children: roots };

fs.writeFileSync('src/mitigation/electionTree.json', JSON.stringify(tree, null, 2));
console.log('Tree converted successfully!');
console.log('Total root nodes:', roots.length);