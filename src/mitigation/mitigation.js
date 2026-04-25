
module.exports = class MitigationController{

    sigmoid(x){
        return 1 / (1 + Math.exp(-x));
    }

    computeOrProbability(children){
        return 1- children.reduce((product, p) => product * (1 - p), 1);
    }

    computeANDProbability(children){
        return children.reduce((product, p) => product *p, 1);
    }

    applyMitigation(node, mitigation, scale = "FLOAT", w_ac = 1, w_td = 1, w_dd = 1){
        let weights = this.normalizeWeights(w_ac, w_td, w_dd);
        let AC = parseFloat(node.a);
        let TD = parseFloat(node.t);
        let DD = parseFloat(node.d);
        if(isNaN(AC) || isNaN(TD) || isNaN(DD)){
            throw new Error(`Node "${node.name}" is missing a, t, or d values`);
        }
        let warnings = this.validateMitigationDirection(node, mitigation);
        if(warnings.length > 0){
            warnings.forEach(w => console.warn(w));
        }
        let baseline = this.computePHA(AC, TD, DD, weights.w_ac, weights.w_td, weights.w_dd, scale);
        let mitigated = this.computePHA(mitigation.AC_new, mitigation.TD_new, mitigation.DD_new, weights.w_ac, weights.w_td, weights.w_dd, scale);
        return{
            baseline: baseline,
            mitigated: mitigated,
            delta: mitigated - baseline,
            original: { AC, TD, DD },
            updated: { AC: mitigation.AC_new, TD: mitigation.TD_new, DD: mitigation.DD_new }
        };
    }

    parseMitigationCSV(csvText){
        let lines = csvText.replace(/\r/g, "").split("\n");
        let metaValues = lines[1].split(",");
        let scale = metaValues[0].trim();
        let w_ac = parseFloat(metaValues[1]);
        let w_td = parseFloat(metaValues[2]);
        let w_dd = parseFloat(metaValues[3]);
        let dataLines = lines.slice(3); 
        let mitigations = [];
        dataLines.forEach(line => {
            if(line.trim() === "") return;
            let parts = line.split(",");
            let mitigation = {
                node_name: parts[0].trim(),
                AC_new: parseFloat(parts[1]),
                TD_new: parseFloat(parts[2]),
                DD_new: parseFloat(parts[3])
            };
            mitigations.push(mitigation);
        });
        return {
            scale: scale,
            weights: {w_ac: w_ac, w_td: w_td, w_dd: w_dd},
            mitigations: mitigations
        };
    }

    analyzeMitigations(tree, mitigations, scale = "FLOAT", w_ac = 1, w_td = 1, w_dd = 1, warnings = []){
        let weights = this.normalizeWeights(w_ac, w_td, w_dd);
        let results = [];
        const walkTree = (node) => {
            if(!node.children || node.children.length === 0){
                let mitigation = mitigations.find(m => 
                    m.node_name.trim().toLowerCase() === node.name.trim().toLowerCase()
                );
                if(mitigation){
                    let nodeWarnings = this.validateMitigationDirection(node, mitigation);
                    nodeWarnings.forEach(w => warnings.push(w));
                    let result = this.applyMitigation(node, mitigation, scale, weights.w_ac, weights.w_td, weights.w_dd);
                    result.node_name = node.name;
                    results.push(result);
                }
            } else{
                node.children.forEach(child => walkTree(child));
            }
        };
        walkTree(tree);
        return results;
    }

    computePHA(AC, TD, DD, w_ac = 0.6, w_td = 0.6, w_dd = 0.8, scale = "FLOAT"){
        let score;
        if(scale == "INT"){
            score = (w_ac * 0.2 / AC) + (w_td * 0.2 / TD) + (w_dd * 0.2 / DD);
            return score;
        } else {
            score = w_dd * DD - w_ac * AC - w_td * TD;
            return this.sigmoid(score);
        }
    }

    computeTreeProbability(node, scale = "FLOAT", w_ac = 1, w_td = 1, w_dd = 1){
        let weights = this.normalizeWeights(w_ac, w_td, w_dd);
        if(!node.children || node.children.length === 0){
            let AC = parseFloat(node.a);
            let TD = parseFloat(node.t);
            let DD = parseFloat(node.d);
            if(isNaN(AC) || isNaN(TD) || isNaN(DD)){
                console.warn(`Warning: Node "${node.name}" is missing a, t, or d values — skipping`);
                return 0;
            }
            return this.computePHA(AC, TD, DD, weights.w_ac, weights.w_td, weights.w_dd, scale);
        }
        let childProbs = node.children.map(child => 
            this.computeTreeProbability(child, scale, w_ac, w_td, w_dd)
        );
        if(node.operator === "OR"){
            return this.computeOrProbability(childProbs);
        } else {
            return this.computeANDProbability(childProbs);
        }
    }

    computeDeltaLikelihood(tree, mitigations, scale = "FLOAT", w_ac = 1, w_td = 1, w_dd = 1){
        let weights = this.normalizeWeights(w_ac, w_td, w_dd);
        let baselineProbability = this.computeTreeProbability(tree, scale, weights.w_ac, weights.w_td, weights.w_dd);
        let mitigatedTree = JSON.parse(JSON.stringify(tree));
        const applyToTree = (node) => {
            if(!node.children || node.children.length === 0){
                let mitigation = mitigations.find(m => 
                    m.node_name.trim().toLowerCase() === node.name.trim().toLowerCase()
                );
                if(mitigation){
                    node.a = mitigation.AC_new.toString();
                    node.t = mitigation.TD_new.toString();
                    node.d = mitigation.DD_new.toString();
                }
            } else{
                node.children.forEach(child => applyToTree(child));
            }
        };
        applyToTree(mitigatedTree);
        let mitigatedProbability = this.computeTreeProbability(mitigatedTree, scale, weights.w_ac, weights.w_td, weights.w_dd);
        return {
            baseline: baselineProbability,
            mitigated: mitigatedProbability,
            delta: mitigatedProbability - baselineProbability
        };
    }

    computeBranchResults(tree, mitigations, scale = "FLOAT", w_ac = 1, w_td = 1, w_dd = 1){
        let weights = this.normalizeWeights(w_ac, w_td, w_dd);

        if(!tree.children || tree.children.length === 0){
            return [];
        }

        let branchResults = [];
        tree.children.forEach(branch => {
            let branchDelta = this.computeDeltaLikelihood(
                branch,
                mitigations,
                scale,
                weights.w_ac,
                weights.w_td,
                weights.w_dd
            );
            branchResults.push({
                branch_name: branch.name,
                baseline: branchDelta.baseline,
                mitigated: branchDelta.mitigated,
                delta: branchDelta.delta
            });
        });

        return branchResults;
    }

    normalizeWeights(w_ac, w_td, w_dd){
        if(w_ac <= 0 || w_td <= 0 || w_dd <= 0){
            throw new Error("All weights must be positive numbers greater than 0");
        }
        let total = w_ac + w_td + w_dd;
        return {
            w_ac: w_ac / total,
            w_td: w_td / total,
            w_dd: w_dd / total
        };
    }

    runMitigationAnalysis(tree, csvText){
        let csvResult = this.parseMitigationCSV(csvText);
        let weights = this.normalizeWeights(
            csvResult.weights.w_ac,
            csvResult.weights.w_td,
            csvResult.weights.w_dd
        );
        let allWarnings = [];
        let nodeResults = this.analyzeMitigations(
            tree,
            csvResult.mitigations,
            csvResult.scale,
            weights.w_ac,
            weights.w_td,
            weights.w_dd,
            allWarnings
        );
        let deltaLikelihood = this.computeDeltaLikelihood(
            tree,
            csvResult.mitigations,
            csvResult.scale,
            weights.w_ac,
            weights.w_td,
            weights.w_dd
        );

        let branchResults = this.computeBranchResults(
            tree, 
            csvResult.mitigations, 
            csvResult.scale, 
            weights.w_ac, 
            weights.w_td, 
            weights.w_dd
        );

        return {
            scale: csvResult.scale,
            weights: weights,
            nodeResults: nodeResults,
            deltaLikelihood: deltaLikelihood,
            warnings: allWarnings,
            branchResults
        };
    }

    validateMitigationDirection(node, mitigation){
        let AC = parseFloat(node.a);
        let TD = parseFloat(node.t);
        let DD = parseFloat(node.d);
        let warnings = [];
        if(mitigation.AC_new < AC){
            warnings.push(`Warning: AC decreased for node "${node.name}" — AC should only increase after mitigation`);
        }
        if(mitigation.TD_new < TD){
            warnings.push(`Warning: TD decreased for node "${node.name}" — TD should only increase after mitigation`);
        }
        if(mitigation.DD_new > DD){
            warnings.push(`Warning: DD increased for node "${node.name}" — DD should only decrease after mitigation`);
        }
        return warnings;
    }
}