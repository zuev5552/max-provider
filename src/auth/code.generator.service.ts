import { Injectable } from '@nestjs/common';

@Injectable()
export class CodeGeneratorService {
  generateCode(): number {
    return Math.floor(1000 + Math.random() * 9000);
  }

  isValidCodeInput(input: string): boolean {
    return /^\d{4}$/.test(input);
  }
}
