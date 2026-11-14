import { changeUserEmail } from "./changeUserEmail";
import { userRepository, User } from "./userRepository";
import { registerUser } from "../registration/registerUser";
import { RegistrationError, RegistrationErrorCode } from "../registration/errors";

let user: User;

beforeEach(() => {
  userRepository.reset();
  user = registerUser({ email: "user@example.com", username: "user", password: "s3cret-pass" });
});

function change(newEmail: string, username = "user", currentEmail = "user@example.com") {
  return changeUserEmail({ username, currentEmail, newEmail });
}

function expectError(fn: () => unknown, code: RegistrationErrorCode): RegistrationError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RegistrationError);
    expect((e as RegistrationError).code).toBe(code);
    return e as RegistrationError;
  }
  throw new Error(`Expected RegistrationError with code ${code}, but nothing was thrown`);
}

describe("changeUserEmail", () => {
  describe("AC1: successful change", () => {
    it("changes the email and keeps id and username", () => {
      const updated = change("user1234@example.com");

      expect(updated).toEqual({ id: user.id, username: "user", email: "user1234@example.com" });
      expect(userRepository.findByEmail("user1234@example.com")?.id).toBe(user.id);
      expect(userRepository.findByEmail("user@example.com")).toBeUndefined();
    });

    it("stores the new email normalized", () => {
      const updated = change(" User1234@Example.com ");

      expect(updated.email).toBe("user1234@example.com");
    });
  });

  describe("AC2: same email", () => {
    it("does nothing when the new email equals the current one after normalization", () => {
      const result = change(" USER@example.com ");

      expect(result).toEqual({ id: user.id, username: "user", email: "user@example.com" });
      expect(userRepository.findByEmail("user@example.com")?.id).toBe(user.id);
    });
  });

  describe("AC3: invalid email", () => {
    it.each([
      ["from the spec", "user new@example"],
      ["with a space", "user new@example.com"],
      ["without a top-level domain", "user@example"],
      ["blank", "   "],
    ])("rejects an email %s with INVALID_INPUT", (_, newEmail) => {
      const error = expectError(() => change(newEmail), "INVALID_INPUT");

      expect(error.fields.email).toEqual(["must be a valid email"]);
      expect(userRepository.findByEmail("user@example.com")?.id).toBe(user.id);
    });
  });

  describe("AC4: email already taken", () => {
    it.each(["john@example.com", "John@Example.com"])(
      "rejects %s with EMAIL_TAKEN",
      (newEmail) => {
        expectError(() => change(newEmail), "EMAIL_TAKEN");

        expect(userRepository.findByEmail("user@example.com")?.id).toBe(user.id);
        expect(userRepository.findByEmail("john@example.com")?.username).toBe("John_Doe");
      },
    );
  });

  describe("user lookup by current username and email", () => {
    it("finds the user when the current email differs in case and spaces", () => {
      const updated = change("user1234@example.com", "user", " USER@Example.com ");

      expect(updated.id).toBe(user.id);
      expect(updated.email).toBe("user1234@example.com");
    });

    it.each([
      ["a wrong username", "other", "user@example.com"],
      ["a username in a different case", "User", "user@example.com"],
      ["someone else's email", "user", "john@example.com"],
      ["an unknown email", "user", "nobody@example.com"],
    ])("rejects %s with USER_NOT_FOUND", (_, username, currentEmail) => {
      expectError(() => change("user1234@example.com", username, currentEmail), "USER_NOT_FOUND");

      expect(userRepository.findByEmail("user1234@example.com")).toBeUndefined();
      expect(userRepository.findByEmail("user@example.com")?.id).toBe(user.id);
      expect(userRepository.findByEmail("john@example.com")?.username).toBe("John_Doe");
    });

    it("changes the right user when two users share a username", () => {
      const twin = registerUser({
        email: "twin@example.com",
        username: "user",
        password: "s3cret-pass",
      });

      const updated = change("twin.new@example.com", "user", "twin@example.com");

      expect(updated.id).toBe(twin.id);
      expect(userRepository.findByEmail("twin@example.com")).toBeUndefined();
      expect(userRepository.findByEmail("user@example.com")?.id).toBe(user.id);
    });
  });
});
