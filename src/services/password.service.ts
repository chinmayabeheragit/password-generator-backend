interface Options {
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
}

const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}<>?',
};

class PasswordService {
  /**
   * Evaluate password strength based on entropy
   */
  private evaluateStrength(password: string, poolSize: number): string {
    const entropy = password.length * Math.log2(poolSize);

    if (entropy < 40) return 'Weak';
    else if (entropy < 60) return 'Medium';
    else return 'Strong';
  }

  /**
   * Generate a random password based on options
   */
  generatePassword(length: number, options: Options) {
    const startTime = performance.now();

    let pool = '';

    if (options.upper) pool += CHARSETS.upper;
    if (options.lower) pool += CHARSETS.lower;
    if (options.numbers) pool += CHARSETS.numbers;
    if (options.symbols) pool += CHARSETS.symbols;

    if (!pool) {
      throw new Error('At least one character type must be selected');
    }

    let result = '';
    
    // Use crypto.getRandomValues for better randomness in production
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      const randomIndex = array[i] % pool.length;
      result += pool[randomIndex];
    }

    const endTime = performance.now();
    const responseTime = Math.round((endTime - startTime) * 100) / 100;

    return {
      password: result,
      strength: this.evaluateStrength(result, pool.length),
      responseTime,
      poolSize: pool.length,
    };
  }

  /**
   * Validate password generation options
   */
  validateOptions(length: number, options: Options): { valid: boolean; error?: string } {
    if (!Number.isInteger(length)) {
      return { valid: false, error: 'Length must be an integer' };
    }

    if (length < 4 || length > 64) {
      return { valid: false, error: 'Length must be between 4 and 64' };
    }

    if (!options.upper && !options.lower && !options.numbers && !options.symbols) {
      return { valid: false, error: 'At least one character type must be selected' };
    }

    return { valid: true };
  }
}

export default new PasswordService();