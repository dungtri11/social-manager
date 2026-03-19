/**
 * Content Randomization Service
 *
 * Implements spin syntax for generating unique content variations
 * Prevents duplicate comments and maintains natural diversity
 *
 * Spin Syntax Examples:
 * - "{Hello|Hi|Hey}" → randomly picks one option
 * - "{Great|Amazing} {post|content}!" → "Great post!" or "Amazing content!"
 * - Nested: "{I {love|like} this|This is {great|awesome}}"
 */

export interface SpinOptions {
  template: string;
}

export interface SpinResult {
  original: string;
  output: string;
  variations: number;
}

class ContentService {
  /**
   * Parse and process spin syntax
   * Supports nested brackets: {option1|option2|{nested1|nested2}}
   */
  spin(template: string): string {
    let result = template;
    let maxIterations = 100; // Prevent infinite loops
    let iteration = 0;

    // Process nested spin syntax from innermost to outermost
    while (result.includes('{') && iteration < maxIterations) {
      // Find innermost bracket pair (no nested brackets inside)
      const match = result.match(/\{([^{}]+)\}/);

      if (!match) break;

      const fullMatch = match[0]; // e.g., "{Hello|Hi|Hey}"
      const content = match[1];   // e.g., "Hello|Hi|Hey"

      // Split by pipe and randomly select one
      const options = content.split('|').map(opt => opt.trim());
      const selected = this.randomChoice(options);

      // Replace the match with selected option
      result = result.replace(fullMatch, selected);

      iteration++;
    }

    return result;
  }

  /**
   * Generate multiple unique variations from a template
   */
  generateVariations(template: string, count: number = 5): string[] {
    const variations = new Set<string>();
    let attempts = 0;
    const maxAttempts = count * 10; // Try more times to get unique results

    while (variations.size < count && attempts < maxAttempts) {
      const output = this.spin(template);
      variations.add(output);
      attempts++;
    }

    return Array.from(variations);
  }

  /**
   * Calculate total possible variations in a template
   */
  countVariations(template: string): number {
    let count = 1;
    const matches = template.match(/\{[^{}]+\}/g);

    if (!matches) return 1;

    matches.forEach(match => {
      const content = match.slice(1, -1); // Remove { }
      const options = content.split('|');
      count *= options.length;
    });

    return count;
  }

  /**
   * Select random item from array
   */
  private randomChoice<T>(array: T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
  }

  /**
   * Get a random comment template
   * Pre-defined templates with spin syntax
   */
  getRandomCommentTemplate(): string {
    const templates = [
      // Simple appreciation
      "{Great|Amazing|Awesome|Wonderful|Fantastic} {post|content|share}!",
      "{Love|Like|Enjoy} this {so much|a lot}!",
      "{This is|It's} {really|so|very} {good|great|nice|cool}!",

      // Emotional reactions
      "{I love|Love|Really love} {this|it}! {😍|❤️|🔥|👏}",
      "{So|Very|Really} {inspiring|motivating|helpful|interesting}!",
      "{This made my day|Made my day|Brightened my day}! {Thanks|Thank you}!",

      // Agreement/Support
      "{Totally|Completely|100%} {agree|agreed}!",
      "{Couldn't agree more|Exactly|So true|Well said}!",
      "{You're|You are} {absolutely right|so right|right on}!",

      // Gratitude
      "{Thanks for|Thank you for} {sharing|posting} this!",
      "{Appreciate|Love|Value} {you sharing|this share}!",
      "{This is|It's} {exactly|just} what I needed! {Thanks|Thank you}!",

      // Questions/Engagement
      "{Wow|Amazing}! Where {did you|can I} {find|get} this?",
      "{Love|Like} this! {Any|Got any} more {info|details|information}?",
      "{Interesting|Cool}! {Tell me|Share} more?",

      // Mixed complex
      "{Hey|Hi}, {this is|it's} {really|super|so} {helpful|useful|valuable}! {Thanks|Thank you} for {sharing|posting}!",
      "{Absolutely|Totally|Completely} {love|loving} {this|it}! {Keep it up|More please|Want more}!",
      "{Great|Awesome|Amazing} {work|job|content}! {Very|So|Really} {inspiring|motivating|impressive}!",
    ];

    return this.randomChoice(templates);
  }

  /**
   * Generate a unique comment
   */
  generateComment(): SpinResult {
    const template = this.getRandomCommentTemplate();
    const output = this.spin(template);
    const variations = this.countVariations(template);

    return {
      original: template,
      output,
      variations,
    };
  }

  /**
   * Get random caption template for posts
   */
  getRandomCaptionTemplate(): string {
    const templates = [
      "{Excited|Thrilled|Happy} to share this with you {all|everyone}! {😊|🎉|✨}",
      "{Here's|Check out} {something|a little something} {special|I've been working on}!",
      "{New|Fresh} {content|post|update} {alert|incoming}! {Hope you|You'll} {enjoy|love} it!",
      "{Just|Simply} {wanted|thought} to {share|post} this {moment|experience}!",
      "{Feeling|So} {grateful|blessed|thankful} {today|right now}! {❤️|🙏|✨}",
    ];

    return this.randomChoice(templates);
  }

  /**
   * Generate a unique caption
   */
  generateCaption(): SpinResult {
    const template = this.getRandomCaptionTemplate();
    const output = this.spin(template);
    const variations = this.countVariations(template);

    return {
      original: template,
      output,
      variations,
    };
  }

  /**
   * Test spin syntax with custom template
   */
  testSpin(template: string, count: number = 5): {
    template: string;
    variations: string[];
    totalPossible: number;
  } {
    return {
      template,
      variations: this.generateVariations(template, count),
      totalPossible: this.countVariations(template),
    };
  }
}

export const contentService = new ContentService();
export default contentService;
