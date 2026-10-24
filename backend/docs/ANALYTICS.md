# Gridbricks Analytics & Metrics Specification

This document details the mathematical formulas, conventions, units, and procurement interpretations implemented in the Gridbricks analytical engine.

---

## 1. Mathematical Definitions & Formulas

Let:
- $F_i$: Selected eligible forecast wind generation power in Megawatts (MW) for interval $i$.
- $A_i$: Eventual actual outturn wind generation power in Megawatts (MW) for interval $i$.
- $N$: Number of valid matched intervals where both $F_i$ and $A_i$ are present.
- $\Delta t$: Interval duration in hours, strictly defined as $0.5\,\text{h}$ for UK 30-minute settlement periods.

### 1.1 Error Sign Convention
$$\text{Signed Error } e_i = F_i - A_i$$
- **Positive Error ($e_i > 0$)**: **Overforecast**. Wind generation was predicted higher than actual outturn. In day-ahead procurement, this typically means the utility contracted more wind energy than was physically produced.
- **Negative Error ($e_i < 0$)**: **Underforecast**. Wind generation was predicted lower than actual outturn. The utility produced more wind power than forecasted.

### 1.2 Mean Absolute Error (MAE)
Measures the average magnitude of forecast errors in Megawatts (MW), giving equal weight to all deviations:
$$\text{MAE} = \frac{1}{N} \sum_{i=1}^{N} |F_i - A_i|$$
- **Unit**: MW

### 1.3 Root Mean Squared Error (RMSE)
Measures the square root of the mean squared errors in Megawatts (MW), penalizing large errors more heavily:
$$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (F_i - A_i)^2}$$
- **Unit**: MW
- $\text{RMSE} \ge \text{MAE}$, with the difference indicating the variance of individual error magnitudes.

### 1.4 Mean Error / Forecast Bias
Measures the systemic tendency of the forecast model to over- or under-predict wind generation:
$$\text{Bias} = \frac{1}{N} \sum_{i=1}^{N} (F_i - A_i)$$
- **Unit**: MW
- $\text{Bias} > 0$: Persistent overforecasting.
- $\text{Bias} < 0$: Persistent underforecasting.
- $\text{Bias} \approx 0$: Errors are balanced, though individual hourly errors may still be substantial.

### 1.5 Weighted Absolute Percentage Error (WAPE)
Measures aggregate percentage error weighted by the total energy produced:
$$\text{WAPE} = \frac{\sum_{i=1}^{N} |F_i - A_i|}{\sum_{i=1}^{N} A_i} \times 100\%$$
- **Unit**: Percent (%)
- **Zero-Denominator Rule**: If $\sum A_i = 0$ (e.g. calm wind across all intervals), WAPE is mathematically undefined and returned as `null` rather than generating an error or infinity.
- **Superiority over MAPE**: Ordinary MAPE divides by individual interval actuals ($|F_i - A_i| / A_i$), which explodes when wind generation drops near zero. WAPE divides by the aggregate sum, ensuring stable and robust percentage metrics.

### 1.6 90th Percentile Absolute Error (P90)
Quantifies the error threshold that exceeds 90% of observed absolute errors:
$$\text{P90} = \text{percentile}(|F_i - A_i|, 90)$$
- **Unit**: MW
- Computed using deterministic linear interpolation across ordered error ranks.
- Critical for procurement risk management and sizing reserve capacity.

### 1.7 Energy Equivalent Error Volume (MWh)
Converts average power divergence into physical electricity volume:
$$\text{Error MWh}_i = (F_i - A_i) \times \Delta t = (F_i - A_i) \times 0.5$$
$$\text{Total Net Energy Error MWh} = \sum_{i=1}^{N} \text{Error MWh}_i$$
- **Unit**: Megawatt-hours (MWh)

---

## 2. Aggregation Methodology

### Monthly Aggregates vs. Averaging Daily Values
Gridbricks **does not average daily MAE or RMSE numbers** to compute monthly metrics. Averaging daily numbers causes statistical bias when interval counts differ or generation scale fluctuates across days.

Instead, Gridbricks aggregates all valid matched intervals across the entire month and computes MAE, RMSE, Bias, and WAPE directly over the true monthly population:
$$\text{MAE}_{\text{month}} = \frac{1}{\sum N_d} \sum_{d} \sum_{i \in d} |F_{d,i} - A_{d,i}|$$

---

## 3. Data Completeness & Coverage

### Coverage Ratio
$$\text{Coverage Ratio} = \frac{\text{Matched Intervals}}{\text{Expected Intervals}}$$
- In a normal 31-day January, expected intervals = $31 \times 48 = 1,488$.
- If 1,440 intervals are matched, $\text{Coverage} = 1440 / 1488 = 96.77\%$.
- Missing intervals are excluded from error calculations to preserve mathematical integrity, but remain prominently reported in completeness indicators.

---

## 4. Procurement Interpretation & Boundary

### Planning vs. Physical Imbalance
- Forecast errors highlight procurement planning risk at the day-ahead stage.
- However, wind forecast error is **not identical to actual cashout or physical imbalance exposure**, because:
  1. Other portfolio assets (thermal, hydro, batteries, interconnectors) adjust positions intraday.
  2. Consumer demand also varies and may offset or compound wind errors.
  3. Commercial trades and physical balancing actions are subject to BM cashout prices (SSP/SBP).
- Power and energy metrics are provided purely within the permitted Elexon `FUELHH` and `WINDFOR` scope.
