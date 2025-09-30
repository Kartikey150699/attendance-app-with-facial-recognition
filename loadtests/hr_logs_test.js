import http from "k6/http";
import { sleep, check } from "k6";

// Define the options
export let options = {
  stages: [
    { duration: "10s", target: 50 },   // ramp-up to 50 users
    { duration: "30s", target: 50 },   // stay at 50 users
    { duration: "10s", target: 0 },    // ramp-down to 0
  ],
};

// The test
export default function () {
  let res = http.get("http://127.0.0.1:8000/hr_logs/?year=2025&month=9&employee_id=IFNT012");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "body is not empty": (r) => r.body.length > 0,
  });

  sleep(1); // wait before next request
}