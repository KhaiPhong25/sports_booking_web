import { Injectable } from "@nestjs/common";
import { hash, verify } from "argon2";

@Injectable()
export class PasswordService {
  hash(value: string): Promise<string> {
    return hash(value, { type: 2 });
  }

  verify(hashValue: string, value: string): Promise<boolean> {
    return verify(hashValue, value);
  }
}
