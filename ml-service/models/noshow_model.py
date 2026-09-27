"""
============================================================
SKYVOYAGE ENTERPRISE — No-Show Prediction Model
============================================================
Supervised Logistic Regression for passenger no-show prediction.

Generates synthetic training data from route-specific parameters,
trains a logistic regression model, and exports model weights for
use by the JavaScript mirror (capacityService.js).

Academic Concepts:
- Feature engineering (categorical encoding, normalization)
- Logistic regression (sigmoid, cross-entropy loss, gradient descent)
- Model evaluation (accuracy, confusion matrix, ROC-AUC)
- Serialization for cross-platform inference

Usage:
    python ml-service/models/noshow_model.py
============================================================
"""

import json
import math
import random
import os
from datetime import datetime

# ══════════════════════════════════════════════════════════
#  SYNTHETIC DATA GENERATION
# ══════════════════════════════════════════════════════════

ROUTE_BASE_RATES = {
    "DEL-BOM": 0.08, "BOM-DEL": 0.09, "BLR-DEL": 0.07,
    "DEL-BLR": 0.06, "BOM-HYD": 0.10, "HYD-BOM": 0.09,
    "MAA-CCU": 0.12, "CCU-MAA": 0.11, "HYD-GOI": 0.15,
    "GOI-HYD": 0.14, "CCU-BLR": 0.08, "BLR-CCU": 0.07,
    "DEL-GOI": 0.13, "BOM-GOI": 0.11,
}

TIERS = ["basic", "bronze", "silver", "gold"]
TIER_WEIGHTS = {"basic": 1, "bronze": 2, "silver": 3, "gold": 4}


def generate_training_data(n_samples=2000, seed=42):
    """
    Generate synthetic booking records with no-show labels.

    Features:
        - route (categorical → encoded)
        - day_of_week (0=Mon, 6=Sun)
        - departure_hour (0-23)
        - tier (categorical → weight)
        - season (categorical → encoded)
        - days_before_departure (1-90)

    Label: no_show (0 or 1)
    """
    random.seed(seed)
    routes = list(ROUTE_BASE_RATES.keys())
    seasons = ["regular", "monsoon", "holiday"]
    data = []

    for _ in range(n_samples):
        route = random.choice(routes)
        day_of_week = random.randint(0, 6)
        hour = random.randint(0, 23)
        tier = random.choice(TIERS)
        season = random.choice(seasons)
        days_before = random.randint(1, 90)

        # Base no-show probability from route
        p = ROUTE_BASE_RATES.get(route, 0.10)

        # Feature adjustments (same as JS mirror)
        if day_of_week >= 5:     # Weekend
            p += 0.03
        if hour < 7:             # Early morning
            p += 0.02
        if hour > 22:            # Late night
            p += 0.015
        if tier == "gold":
            p -= 0.04
        elif tier == "silver":
            p -= 0.025
        elif tier == "bronze":
            p -= 0.01
        if season == "monsoon":
            p += 0.02
        if season == "holiday":
            p += 0.03
        if days_before > 60:     # Very early bookings
            p += 0.02

        # Clamp probability
        p = max(0.01, min(0.40, p))

        # Generate label
        no_show = 1 if random.random() < p else 0

        data.append({
            "route": route,
            "day_of_week": day_of_week,
            "departure_hour": hour,
            "tier": tier,
            "tier_weight": TIER_WEIGHTS[tier],
            "season": season,
            "days_before_departure": days_before,
            "no_show": no_show,
        })

    return data


# ══════════════════════════════════════════════════════════
#  LOGISTIC REGRESSION (from scratch)
# ══════════════════════════════════════════════════════════

def sigmoid(z):
    """Sigmoid activation: σ(z) = 1 / (1 + e^(-z))"""
    # Clamp to avoid overflow
    z = max(-500, min(500, z))
    return 1.0 / (1.0 + math.exp(-z))


def encode_features(record):
    """
    Encode a record into a numerical feature vector.

    Features (7 dimensions):
        [is_weekend, hour_normalized, tier_weight_normalized,
         is_monsoon, is_holiday, days_before_normalized, route_base_rate]
    """
    return [
        1.0 if record["day_of_week"] >= 5 else 0.0,            # is_weekend
        record["departure_hour"] / 23.0,                         # hour_normalized
        record["tier_weight"] / 4.0,                             # tier_weight_normalized
        1.0 if record["season"] == "monsoon" else 0.0,          # is_monsoon
        1.0 if record["season"] == "holiday" else 0.0,          # is_holiday
        record["days_before_departure"] / 90.0,                  # days_before_normalized
        ROUTE_BASE_RATES.get(record["route"], 0.10) * 10.0,     # route_base_rate (scaled)
    ]


class LogisticRegression:
    """
    Binary logistic regression classifier trained with gradient descent.

    Loss: Binary Cross-Entropy
        L = -1/N Σ [y·log(ŷ) + (1-y)·log(1-ŷ)]

    Update rule:
        w := w - α · ∂L/∂w
        b := b - α · ∂L/∂b
    """

    def __init__(self, n_features):
        self.n_features = n_features
        self.weights = [0.0] * n_features
        self.bias = 0.0
        self.training_history = []

    def predict_proba(self, features):
        """Compute P(no_show=1 | features)."""
        z = self.bias + sum(w * x for w, x in zip(self.weights, features))
        return sigmoid(z)

    def predict(self, features, threshold=0.5):
        """Binary prediction."""
        return 1 if self.predict_proba(features) >= threshold else 0

    def fit(self, X, y, learning_rate=0.1, epochs=200, verbose=True):
        """
        Train the model using mini-batch gradient descent.

        Args:
            X: list of feature vectors
            y: list of labels (0 or 1)
            learning_rate: step size (α)
            epochs: number of training passes
        """
        n = len(X)

        for epoch in range(epochs):
            total_loss = 0.0
            grad_w = [0.0] * self.n_features
            grad_b = 0.0

            for features, label in zip(X, y):
                # Forward pass
                y_hat = self.predict_proba(features)

                # Cross-entropy loss
                eps = 1e-15
                loss = -(label * math.log(y_hat + eps) + (1 - label) * math.log(1 - y_hat + eps))
                total_loss += loss

                # Gradient computation
                error = y_hat - label
                for j in range(self.n_features):
                    grad_w[j] += error * features[j]
                grad_b += error

            # Update weights
            for j in range(self.n_features):
                self.weights[j] -= learning_rate * (grad_w[j] / n)
            self.bias -= learning_rate * (grad_b / n)

            avg_loss = total_loss / n
            self.training_history.append(avg_loss)

            if verbose and (epoch % 50 == 0 or epoch == epochs - 1):
                accuracy = self.evaluate(X, y)
                print(f"  Epoch {epoch:>4d}/{epochs} | Loss: {avg_loss:.4f} | Accuracy: {accuracy:.2%}")

        return self

    def evaluate(self, X, y):
        """Compute accuracy."""
        correct = sum(1 for features, label in zip(X, y) if self.predict(features) == label)
        return correct / len(y)

    def confusion_matrix(self, X, y):
        """Compute confusion matrix: [[TN, FP], [FN, TP]]"""
        tp = fp = tn = fn = 0
        for features, label in zip(X, y):
            pred = self.predict(features)
            if pred == 1 and label == 1: tp += 1
            elif pred == 1 and label == 0: fp += 1
            elif pred == 0 and label == 0: tn += 1
            else: fn += 1
        return {"TP": tp, "FP": fp, "TN": tn, "FN": fn,
                "precision": tp / (tp + fp) if (tp + fp) > 0 else 0,
                "recall": tp / (tp + fn) if (tp + fn) > 0 else 0}

    def export_weights(self):
        """Export model parameters for JS inference mirror."""
        return {
            "weights": self.weights,
            "bias": self.bias,
            "n_features": self.n_features,
            "feature_names": [
                "is_weekend", "hour_normalized", "tier_weight_normalized",
                "is_monsoon", "is_holiday", "days_before_normalized",
                "route_base_rate"
            ],
        }


# ══════════════════════════════════════════════════════════
#  EXPECTED COST MINIMIZATION
# ══════════════════════════════════════════════════════════

def binomial_pmf(n, k, p):
    """Binomial probability mass function P(X=k)."""
    if k > n or k < 0:
        return 0.0
    coeff = 1.0
    for i in range(min(k, n - k)):
        coeff = coeff * (n - i) / (i + 1)
    return coeff * (p ** k) * ((1 - p) ** (n - k))


def compute_expected_cost(capacity, overbook_level, no_show_rate,
                          bump_cost=15000, spoil_loss=4500):
    """
    Compute E[Cost] = Σ P(X=k) · [BumpCost·max(0,k-C) + SpoilLoss·max(0,C-k)]

    where X ~ Binomial(C + b, 1 - no_show_rate)
    """
    total_booked = capacity + overbook_level
    show_up_prob = 1 - no_show_rate
    expected_cost = 0.0

    for k in range(total_booked + 1):
        prob = binomial_pmf(total_booked, k, show_up_prob)
        bump_penalty = max(0, k - capacity) * bump_cost
        spoil_penalty = max(0, capacity - k) * spoil_loss
        expected_cost += prob * (bump_penalty + spoil_penalty)

    return expected_cost


def find_optimal_overbooking(capacity, no_show_rate, max_overbook=15,
                             bump_cost=15000, spoil_loss=4500):
    """Find the overbooking level b that minimizes E[Cost]."""
    best_b = 0
    best_cost = float("inf")
    cost_curve = []

    for b in range(max_overbook + 1):
        cost = compute_expected_cost(capacity, b, no_show_rate, bump_cost, spoil_loss)
        cost_curve.append({"overbooking_level": b, "expected_cost": round(cost, 2)})
        if cost < best_cost:
            best_cost = cost
            best_b = b

    return {
        "optimal_level": best_b,
        "minimum_expected_cost": round(best_cost, 2),
        "cost_curve": cost_curve,
    }


# ══════════════════════════════════════════════════════════
#  MAIN — Train model and export results
# ══════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("SKYVOYAGE ENTERPRISE — No-Show Prediction Model")
    print("=" * 60)

    # 1. Generate training data
    print("\n[1/4] Generating synthetic training data...")
    data = generate_training_data(n_samples=2000)
    no_show_count = sum(1 for d in data if d["no_show"] == 1)
    print(f"  Generated {len(data)} samples ({no_show_count} no-shows, {len(data)-no_show_count} show-ups)")

    # 2. Encode features
    print("\n[2/4] Encoding features...")
    X = [encode_features(d) for d in data]
    y = [d["no_show"] for d in data]

    # Train/test split (80/20)
    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    print(f"  Train: {len(X_train)} samples | Test: {len(X_test)} samples")

    # 3. Train logistic regression
    print("\n[3/4] Training Logistic Regression (7 features, 200 epochs)...")
    model = LogisticRegression(n_features=7)
    model.fit(X_train, y_train, learning_rate=0.5, epochs=200)

    # Evaluate
    train_acc = model.evaluate(X_train, y_train)
    test_acc = model.evaluate(X_test, y_test)
    cm = model.confusion_matrix(X_test, y_test)

    print(f"\n  Train Accuracy: {train_acc:.2%}")
    print(f"  Test Accuracy:  {test_acc:.2%}")
    print(f"  Precision:      {cm['precision']:.2%}")
    print(f"  Recall:         {cm['recall']:.2%}")
    print(f"  Confusion Matrix: TP={cm['TP']}, FP={cm['FP']}, TN={cm['TN']}, FN={cm['FN']}")

    # 4. Export model and run overbooking analysis
    print("\n[4/4] Running overbooking optimization...")
    overbooking_result = find_optimal_overbooking(
        capacity=152, no_show_rate=0.10
    )
    print(f"  Optimal overbooking level: +{overbooking_result['optimal_level']} seats")
    print(f"  Minimum expected cost: INR {overbooking_result['minimum_expected_cost']:,.2f}")

    # Export results
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output = {
        "model": model.export_weights(),
        "training": {
            "samples": len(data),
            "train_accuracy": round(train_acc, 4),
            "test_accuracy": round(test_acc, 4),
            "confusion_matrix": cm,
            "loss_history": model.training_history[-10:],
        },
        "overbooking_analysis": overbooking_result,
        "route_base_rates": ROUTE_BASE_RATES,
        "exported_at": datetime.now().isoformat(),
    }

    output_path = os.path.join(output_dir, "model_output.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n[OK] Model exported to: {output_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
