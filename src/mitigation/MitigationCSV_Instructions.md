# Mitigation CSV Format Instructions

## Overview
This CSV file defines the mitigations to apply to terminal nodes 
in the attack tree. It has two sections: a metadata header and 
a list of node mitigations.

## File Structure
The CSV must follow this exact format:

scale,w_ac,w_td,w_dd

INT,1,1,1

node_name,AC_new,TD_new,DD_new

Form Collaboration of PWs,5,3,2

Gain Exclusive Access to Ballots,5,4,2

## Section 1 — Metadata (Lines 1 and 2)
| Column | Name | Description                                                                     |
|--------|------|---------------------------------------------------------------------------------|
| A      | scale| Either INT (1-5) or FLOAT (0-1)                                                 |
| B      | w_ac | Weight for Attack Cost. Any positive number  automatically normalized           |
| C      | w_td | Weight for Technical Difficulty. Any positive number, automatically normalized  |
| D      | w_dd | Weight for Discovery Difficulty. Any positive number,  automatically normalized |

## Section 2 — Node Mitigations (Line 3 onward)
| Column | Name      | Description                                                      |
|--------|-----------|------------------------------------------------------------------|
| A      | node_name | Exact name of the terminal node as it appears in the attack tree |
| B      | AC_new    | New Attack Cost value after mitigation                           |
| C      | TD_new    | New Technical Difficulty value after mitigation                  |
| D      | DD_new    | New Discovery Difficulty value after mitigation                  |

## Important Rules
- node_name must match the terminal node name exactly as it appears in the attack tree
- All nodes in one CSV must use the same scale
- Weights must be positive numbers greater than 0
- AC and TD can only increase after mitigation
- DD can only decrease after mitigation
- Nodes not listed in the CSV are treated as unmitigated