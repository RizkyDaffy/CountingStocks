import { Request, Response, NextFunction } from "express";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Permintaan tidak valid. Periksa data yang dikirim.",
  401: "Akses ditolak. Silakan login ulang.",
  403: "Anda tidak memiliki izin untuk mengakses resource ini.",
  404: "Resource yang diminta tidak ditemukan.",
  405: "Metode HTTP yang digunakan tidak didukung untuk endpoint ini.",
  409: "Konflik data. Resource mungkin sudah ada.",
  422: "Data tidak dapat diproses. Periksa format input.",
  429: "Terlalu banyak permintaan. Coba lagi beberapa saat.",
  500: "Terjadi kesalahan internal server. Mohon hubungi administrator.",
  502: "Bad Gateway. Server upstream tidak merespons.",
  503: "Layanan sedang tidak tersedia. Coba lagi nanti.",
};

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: STATUS_MESSAGES[404],
    path: req.path,
    method: req.method,
  });
}

export function globalErrorHandler(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status ?? err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === "production";

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "ERROR",
      status,
      name: err.name,
      message: err.message,
      path: req.path,
      method: req.method,
      stack: isProduction ? "[hidden in production]" : err.stack,
    }),
  );

  const clientMessage = isProduction
    ? (STATUS_MESSAGES[status] ?? STATUS_MESSAGES[500])
    : err.message || (STATUS_MESSAGES[status] ?? STATUS_MESSAGES[500]);

  res.status(status).json({
    success: false,
    error: clientMessage,
    ...(isProduction ? {} : { _debug: err.name }),
  });
}
