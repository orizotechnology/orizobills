import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import { errorResponse } from "./response.util";

// =============================================================
// GLOBAL ERROR HANDLER
// Register this with Fastify's setErrorHandler.
// Normalises all errors into the standard ApiErrorResponse shape.
// =============================================================

export function globalErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  // Fastify validation errors (from JSON schema)
  if (error.validation) {
    return reply
      .status(HTTP_STATUS.BAD_REQUEST)
      .send(
        errorResponse(
          "Validation failed",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          { errors: error.validation }
        )
      );
  }

  // Known HTTP errors
  const statusCode = error.statusCode ?? HTTP_STATUS.INTERNAL_ERROR;

  if (statusCode >= 400 && statusCode < 500) {
    return reply
      .status(statusCode)
      .send(errorResponse(error.message, statusCode));
  }

  // Unexpected server errors — log and return generic message
  reply.log.error({ err: error }, "Unhandled server error");

  return reply
    .status(HTTP_STATUS.INTERNAL_ERROR)
    .send(
      errorResponse(
        "An unexpected error occurred",
        HTTP_STATUS.INTERNAL_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      )
    );
}
