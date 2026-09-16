const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@gsm\.hs\.kr$/;
const ID_PATTERN = /^[a-zA-Z0-9]+$/;
const PASSWORD_SPECIAL_CHAR_PATTERN = /[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@\#$%&\\\=\(\'\"]/;

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

export function isValidId(id: string) {
  return id.length >= 4 && id.length <= 12 && ID_PATTERN.test(id);
}

export function isValidPassword(password: string) {
  return (
    password.length >= 4 &&
    password.length <= 20 &&
    PASSWORD_SPECIAL_CHAR_PATTERN.test(password)
  );
}
