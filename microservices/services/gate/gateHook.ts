import http from "http";

const GATE_HTTP_PORT = Number(process.env.GATE_HTTP_PORT) || 4001;
const GATE_HOST = process.env.GATE_HOST || "127.0.0.1";
const GATE_TIMEOUT_MS = 2000;

export function dispatchToGateService(params: { qr_code_id: string }): void {
  const body = JSON.stringify({
    qr_code_id: params.qr_code_id,
    timestamp: new Date().toISOString(),
  });

  const options: http.RequestOptions = {
    hostname: GATE_HOST,
    port: GATE_HTTP_PORT,
    path: "/internal/gate/open",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    timeout: GATE_TIMEOUT_MS,
  };

  setImmediate(() => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => {
        data += c;
      });
      res.on("end", () => {
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            event: "gate_hook_response",
            status: res.statusCode,
            ...params,
            response: (() => {
              try {
                return JSON.parse(data);
              } catch {
                return data.slice(0, 128);
              }
            })(),
          }),
        );
      });
    });

    req.on("timeout", () => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "gate_hook_timeout",
          ...params,
          note: "Gate service did not respond within timeout. Gate may be offline.",
        }),
      );
      req.destroy();
    });

    req.on("error", (err) => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "gate_hook_error",
          ...params,
          err: err.message,
          note: "Gate service unavailable. Scan result was already sent to user.",
        }),
      );
    });

    req.write(body);
    req.end();
  });
}

export function triggerMachineWebhook(params: { machine_code: string; qr_code_id: string }): void {
  const mc = params.machine_code.toLowerCase().replace(/[^a-z0-9]/g, "");
  const qr = encodeURIComponent(params.qr_code_id);

  const body = JSON.stringify({
    qr_code_id: params.qr_code_id,
    machine_code: params.machine_code,
    timestamp: new Date().toISOString(),
  });

  const webhookPath = `/webhook/${mc}/${qr}`;

  const options: http.RequestOptions = {
    hostname: GATE_HOST,
    port: GATE_HTTP_PORT,
    path: webhookPath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    timeout: GATE_TIMEOUT_MS,
  };

  // Fire async, do not await - non-blocking by design
  setImmediate(() => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => {
        data += c;
      });
      res.on("end", () => {
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            event: "machine_webhook_response",
            webhookPath,
            status: res.statusCode,
            ...params,
            response: (() => {
              try {
                return JSON.parse(data);
              } catch {
                return data.slice(0, 128);
              }
            })(),
          }),
        );
      });
    });

    req.on("timeout", () => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "machine_webhook_timeout",
          webhookPath,
          ...params,
          note: "Gate service did not respond within timeout.",
        }),
      );
      req.destroy();
    });

    req.on("error", (err) => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "machine_webhook_error",
          webhookPath,
          ...params,
          err: err.message,
          note: "Gate service unavailable. Scan result was already sent to user.",
        }),
      );
    });

    req.write(body);
    req.end();
  });
}
