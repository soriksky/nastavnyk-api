import { RegistrationError } from "../registration/errors";
import { userRepository, User } from "./userRepository";
import { matches, validate } from "../validation/rules";
import { EMAIL_PATTERN } from "../validation/patterns";

export interface ChangeEmailInput {
  username: string;
  currentEmail: string;
  newEmail: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function changeUserEmail(input: ChangeEmailInput): User {
  // Шукаємо за email (він унікальний), а username звіряємо точно.
  const user = userRepository.findByEmail(normalizeEmail(input.currentEmail));
  if (!user || user.username !== input.username) {
    throw new RegistrationError("USER_NOT_FOUND");
  }

  const email = normalizeEmail(input.newEmail);

  const emailErrors = validate(email, [matches(EMAIL_PATTERN, "must be a valid email")]);
  if (emailErrors.length) {
    throw new RegistrationError("INVALID_INPUT", { email: emailErrors });
  }

  if (email === user.email) return user;

  if (userRepository.findByEmail(email)) throw new RegistrationError("EMAIL_TAKEN");

  return userRepository.updateEmail(user.id, email) as User;
}
