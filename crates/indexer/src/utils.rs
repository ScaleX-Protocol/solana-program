// Utility functions matching Ponder exactly

/// Format amount with proper decimal places
pub fn format_amount(raw_amount: i64, decimals: u8) -> String {
    let amount = raw_amount as f64 / 10_f64.powi(decimals as i32);

    if amount < 0.01 && amount > 0.0 {
        format!("{:.6}", amount)
    } else {
        format!("{:.2}", amount)
    }
}

/// Format USD value
pub fn format_usd(value: i64, decimals: u8) -> String {
    let amount = value as f64 / 10_f64.powi(decimals as i32);
    format!("${:.2}", amount)
}

/// Format APY percentage
pub fn format_apy(apy_basis_points: i64) -> String {
    let apy = apy_basis_points as f64 / 100.0;
    format!("{:.1}%", apy)
}

// Interest rate calculation constants
pub const SECONDS_PER_YEAR: i64 = 31536000;
pub const BASIS_POINTS: i64 = 10000;

/// Calculate utilization rate
pub fn calculate_utilization_rate(total_borrowed: i64, total_liquidity: i64) -> i64 {
    if total_liquidity == 0 {
        return 0;
    }
    (total_borrowed * BASIS_POINTS) / total_liquidity
}

/// Calculate borrow rate based on utilization
pub fn calculate_borrow_rate(
    utilization_rate: i64,
    base_rate: i64,
    optimal_utilization: i64,
    rate_slope1: i64,
    rate_slope2: i64,
) -> i64 {
    if utilization_rate <= optimal_utilization {
        base_rate + (utilization_rate * rate_slope1) / optimal_utilization
    } else {
        let excess_utilization = utilization_rate - optimal_utilization;
        let denominator = BASIS_POINTS - optimal_utilization;
        if denominator == 0 {
            return base_rate + rate_slope1;
        }
        let excess_rate = (excess_utilization * rate_slope2) / denominator;
        base_rate + rate_slope1 + excess_rate
    }
}

/// Calculate supply rate
pub fn calculate_supply_rate(borrow_rate: i64, utilization_rate: i64, reserve_factor: i64) -> i64 {
    if utilization_rate == 0 {
        return 0;
    }
    (borrow_rate * utilization_rate * (BASIS_POINTS - reserve_factor))
        / (BASIS_POINTS * BASIS_POINTS)
}

/// Calculate projected interest over time
pub fn calculate_projected_interest(principal: i64, rate: i64, time_seconds: i64) -> i64 {
    if principal == 0 || rate == 0 || time_seconds <= 0 {
        return 0;
    }
    (principal * rate * time_seconds) / (SECONDS_PER_YEAR * BASIS_POINTS)
}
