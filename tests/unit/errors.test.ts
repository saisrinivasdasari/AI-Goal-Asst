import { describe, it, expect } from "vitest";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  CapacityExceededError,
  ok,
  err,
} from "@/lib/errors";

describe("Typed Errors & Result Pattern Unit Tests", () => {
  it("should create ValidationError with 422 status code", () => {
    const error = new ValidationError("Invalid capacity payload", { field: "sleepHours" });
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Invalid capacity payload");
    expect(error.context).toEqual({ field: "sleepHours" });
  });

  it("should create NotFoundError with 404 status code", () => {
    const error = new NotFoundError("Goal not found");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("should create CapacityExceededError with 422 status code", () => {
    const error = new CapacityExceededError("Goal requires 20h but only 10h available");
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("CAPACITY_EXCEEDED");
  });

  it("should format JSON envelope properly via toJSON()", () => {
    const error = new UnauthorizedError("Session expired");
    const json = error.toJSON();
    expect(json).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Session expired",
        statusCode: 401,
      },
    });
  });

  it("should return typed ok() and err() Result variants", () => {
    const successResult = ok({ goalId: "goal-123" });
    expect(successResult.success).toBe(true);
    if (successResult.success) {
      expect(successResult.data.goalId).toBe("goal-123");
    }

    const failureResult = err(new ValidationError("Required field missing"));
    expect(failureResult.success).toBe(false);
    if (!failureResult.success) {
      expect(failureResult.error.statusCode).toBe(422);
    }
  });
});

