# Latency of the live tutor

<!-- measured:start -->
| Measurement | Runs | Median ms | Best ms | Worst ms |
|---|---|---|---|---|
| typed line: Escape → ✗ mark | 4 | 12 | 11 | 15 |
| typed line: Escape → tutor bubble | 4 | 240 | 227 | 240 |
| AI request: click → "thinking" bubble | 3 | 4 | 3 | 5 |
| AI request: click → mascot thinks | 3 | 4 | 3 | 5 |
| AI request: click → answer in bubble (mock answers after 1500 ms) | 3 | 1521 | 1520 | 1524 |
| pen-up → mascot looks at the line (checking) | 3 | 3 | 2 | 4 |
<!-- measured:end -->
