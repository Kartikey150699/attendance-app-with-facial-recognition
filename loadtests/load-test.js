import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 1000,        // 1000 virtual users
  duration: "30s",  // test length
};

export default function () {
  http.get("http://127.0.0.1:8000/hr_logs/?year=2025&month=9&employee_id=IFNT012");
  sleep(1); // simulate user "think time"
}