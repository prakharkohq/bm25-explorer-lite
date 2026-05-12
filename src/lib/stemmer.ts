// Simplified Porter Stemmer implementation
function hasSuffix(word: string, suffix: string): boolean {
  return word.endsWith(suffix)
}

function replaceSuffix(word: string, suffix: string, replacement: string): string {
  return word.slice(0, word.length - suffix.length) + replacement
}

function countVowelConsonantGroups(stem: string): number {
  // Count the number of VC sequences (measure m)
  let count = 0
  let prevVowel = false
  const vowels = 'aeiou'

  for (let i = 0; i < stem.length; i++) {
    const isVowel = vowels.includes(stem[i]) || (stem[i] === 'y' && i > 0 && !vowels.includes(stem[i - 1]))
    if (!isVowel && prevVowel) count++
    prevVowel = isVowel
  }
  return count
}

function hasVowel(stem: string): boolean {
  return /[aeiou]/.test(stem) || /[^aeiou]y/.test(stem)
}

function endsDoubleConsonant(word: string): boolean {
  const len = word.length
  if (len < 2) return false
  return word[len - 1] === word[len - 2] && !'aeiou'.includes(word[len - 1])
}

function endsCVC(word: string): boolean {
  const len = word.length
  if (len < 3) return false
  const c = word[len - 1]
  const v = word[len - 2]
  const c2 = word[len - 3]
  return !'aeiou'.includes(c) && c !== 'w' && c !== 'x' && c !== 'y'
    && 'aeiou'.includes(v)
    && !'aeiou'.includes(c2)
}

export function stem(word: string): string {
  if (word.length <= 2) return word

  let w = word.toLowerCase()

  // Step 1a
  if (hasSuffix(w, 'sses')) {
    w = replaceSuffix(w, 'sses', 'ss')
  } else if (hasSuffix(w, 'ies')) {
    w = replaceSuffix(w, 'ies', 'i')
  } else if (hasSuffix(w, 'ss')) {
    // no change
  } else if (hasSuffix(w, 's')) {
    w = replaceSuffix(w, 's', '')
  }

  // Step 1b
  let step1bDone = false
  if (hasSuffix(w, 'eed')) {
    const stem = w.slice(0, w.length - 3)
    if (countVowelConsonantGroups(stem) > 0) {
      w = replaceSuffix(w, 'eed', 'ee')
    }
  } else if (hasSuffix(w, 'ed')) {
    const stem = w.slice(0, w.length - 2)
    if (hasVowel(stem)) {
      w = stem
      step1bDone = true
    }
  } else if (hasSuffix(w, 'ing')) {
    const stem = w.slice(0, w.length - 3)
    if (hasVowel(stem)) {
      w = stem
      step1bDone = true
    }
  }

  if (step1bDone) {
    if (hasSuffix(w, 'at') || hasSuffix(w, 'bl') || hasSuffix(w, 'iz')) {
      w = w + 'e'
    } else if (endsDoubleConsonant(w) && !hasSuffix(w, 'l') && !hasSuffix(w, 's') && !hasSuffix(w, 'z')) {
      w = w.slice(0, w.length - 1)
    } else if (countVowelConsonantGroups(w) === 1 && endsCVC(w)) {
      w = w + 'e'
    }
  }

  // Step 1c
  if (hasSuffix(w, 'y') && hasVowel(w.slice(0, w.length - 1))) {
    w = replaceSuffix(w, 'y', 'i')
  }

  // Step 2
  const step2Map: [string, string][] = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'],
    ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
    ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
  ]
  for (const [suffix, replacement] of step2Map) {
    if (hasSuffix(w, suffix)) {
      const base = w.slice(0, w.length - suffix.length)
      if (countVowelConsonantGroups(base) > 0) {
        w = base + replacement
      }
      break
    }
  }

  // Step 3
  const step3Map: [string, string][] = [
    ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
    ['ical', 'ic'], ['ful', ''], ['ness', ''],
  ]
  for (const [suffix, replacement] of step3Map) {
    if (hasSuffix(w, suffix)) {
      const base = w.slice(0, w.length - suffix.length)
      if (countVowelConsonantGroups(base) > 0) {
        w = base + replacement
      }
      break
    }
  }

  // Step 4
  const step4Suffixes = [
    'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
    'ment', 'ent', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
  ]
  for (const suffix of step4Suffixes) {
    if (hasSuffix(w, suffix)) {
      const base = w.slice(0, w.length - suffix.length)
      if (countVowelConsonantGroups(base) > 1) {
        w = base
      }
      break
    }
  }
  if (hasSuffix(w, 'ion')) {
    const base = w.slice(0, w.length - 3)
    if (countVowelConsonantGroups(base) > 1 && (hasSuffix(base, 's') || hasSuffix(base, 't'))) {
      w = base
    }
  }

  // Step 5a
  if (hasSuffix(w, 'e')) {
    const base = w.slice(0, w.length - 1)
    if (countVowelConsonantGroups(base) > 1) {
      w = base
    } else if (countVowelConsonantGroups(base) === 1 && !endsCVC(base)) {
      w = base
    }
  }

  // Step 5b
  if (hasSuffix(w, 'll') && countVowelConsonantGroups(w) > 1) {
    w = w.slice(0, w.length - 1)
  }

  return w
}

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'can', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me',
  'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'his',
  'her', 'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'not', 'only', 'same', 'so', 'than', 'then', 'too',
  'very', 'just', 'as', 'also', 'well', 'if', 'any', 'make', 'use',
])
