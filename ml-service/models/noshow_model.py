import os
import joblib
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.generate_training_data import generate_booking_data

MODEL_FILE = os.path.join(os.path.dirname(__file__), "noshow_pipeline.joblib")

class NoShowPredictor:
    def __init__(self):
        self.pipeline = None
        self.metrics = {}
        self.feature_names = [
            "lead_time",
            "fare_class",
            "is_weekend",
            "group_size",
            "is_loyalty",
            "has_checked_bag",
            "flight_duration_hours"
        ]
        self._load_or_train()

    def _load_or_train(self):
        if os.path.exists(MODEL_FILE):
            try:
                saved = joblib.load(MODEL_FILE)
                self.pipeline = saved["pipeline"]
                self.metrics = saved.get("metrics", {})
                print("Loaded pre-trained No-Show Logistic Regression model.")
                return
            except Exception as e:
                print(f"Failed to load existing model: {e}. Retraining...")

        self.train()

    def train(self, n_samples=10000):
        print(f"Generating {n_samples} training records...")
        X, y, _ = generate_booking_data(n_samples=n_samples)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.20, random_state=42, stratify=y
        )

        # Standard scaler on features + balanced class weighting
        self.pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(class_weight="balanced", random_state=42, max_iter=1000))
        ])

        self.pipeline.fit(X_train, y_train)

        # Evaluate
        y_pred = self.pipeline.predict(X_test)
        y_prob = self.pipeline.predict_proba(X_test)[:, 1]

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred))
        rec = float(recall_score(y_test, y_pred))
        roc = float(roc_auc_score(y_test, y_prob))

        clf = self.pipeline.named_steps["clf"]
        scaler = self.pipeline.named_steps["scaler"]
        
        # Unscaled coefficients for interpretability
        raw_coeffs = clf.coef_[0] / scaler.scale_
        feature_importance = {
            name: float(round(coeff, 4))
            for name, coeff in zip(self.feature_names, raw_coeffs)
        }

        self.metrics = {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "roc_auc": round(roc, 4),
            "sample_size": n_samples,
            "feature_coefficients": feature_importance,
            "intercept": float(round(clf.intercept_[0], 4))
        }

        # Save to disk
        try:
            joblib.dump({"pipeline": self.pipeline, "metrics": self.metrics}, MODEL_FILE)
            print(f"Model trained and saved. AUC={roc:.4f}, Accuracy={acc:.4f}")
        except Exception as e:
            print(f"Warning: Could not save model to disk: {e}")

    def predict(self, lead_time=14, fare_class="economy", is_weekend=0, group_size=1,
                is_loyalty=0, has_checked_bag=0, flight_duration_hours=4.5, total_seats=180):
        """
        Predict no-show probability for a flight or passenger profile.
        Returns:
            prob: float (0.0 to 1.0)
            overbooking_cap: int (number of seats safely overbookable, max 5% of capacity)
        """
        class_map = {"economy": 0, "business": 1, "first": 2}
        fare_code = class_map.get(str(fare_class).lower(), 0)

        feature_vector = np.array([[
            float(lead_time),
            float(fare_code),
            float(is_weekend),
            float(group_size),
            float(is_loyalty),
            float(has_checked_bag),
            float(flight_duration_hours)
        ]])

        prob = float(self.pipeline.predict_proba(feature_vector)[0][1])

        # Overbooking rule:
        # Expected no-shows = total_seats * prob
        # Safety margin: allow up to 60% of expected no-shows, capped at 5% of total capacity
        expected_no_shows = total_seats * prob
        safe_overbooking = int(min(expected_no_shows * 0.6, total_seats * 0.05))

        return {
            "no_show_probability": round(prob, 4),
            "no_show_percentage": f"{round(prob * 100, 1)}%",
            "expected_no_shows": int(round(expected_no_shows)),
            "recommended_overbooking_seats": safe_overbooking,
            "overbooking_capacity": total_seats + safe_overbooking,
            "risk_level": "Low" if prob < 0.08 else "Medium" if prob < 0.18 else "High",
            "model_type": "LogisticRegression (scikit-learn)"
        }

if __name__ == "__main__":
    predictor = NoShowPredictor()
    sample_pred = predictor.predict(lead_time=30, fare_class="economy", total_seats=180)
    print("Metrics:", predictor.metrics)
    print("Sample prediction:", sample_pred)

