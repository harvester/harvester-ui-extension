import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';
import { hostResolvesL10nGlobals, resolveL10nGlobals, setStandalonePrime, standaloneProductName } from '../l10n-globals';

describe('hostResolvesL10nGlobals', () => {
  it('should be true from Rancher 2.16', () => {
    expect(hostResolvesL10nGlobals('v2.16.0')).toBe(true);
    expect(hostResolvesL10nGlobals('v2.17.1')).toBe(true);
  });

  it('should be true for 2.16 head builds', () => {
    expect(hostResolvesL10nGlobals('v2.16.0-68ddd75-head')).toBe(true);
    expect(hostResolvesL10nGlobals('v2.16-136b11a0062247c1b28f107d82283bdb29bc07ae-head')).toBe(true);
  });

  it('should be false before Rancher 2.16', () => {
    expect(hostResolvesL10nGlobals('v2.15.1')).toBe(false);
    expect(hostResolvesL10nGlobals('v2.14.6')).toBe(false);
  });

  it('should be false when the Rancher version is missing or unknown', () => {
    expect(hostResolvesL10nGlobals('')).toBe(false);
    expect(hostResolvesL10nGlobals(undefined)).toBe(false);
    expect(hostResolvesL10nGlobals('dev')).toBe(false);
  });
});

describe('standaloneProductName', () => {
  it('should be Harvester when the server flavor is not prime', () => {
    setStandalonePrime(false);

    expect(standaloneProductName()).toBe('Harvester');
  });

  it('should be SUSE Virtualization when the server flavor is prime', () => {
    setStandalonePrime(true);

    expect(standaloneProductName()).toBe('SUSE Virtualization');
    setStandalonePrime(false);
  });

  it('should go back to Harvester when the server flavor changes from prime', () => {
    setStandalonePrime(true);
    setStandalonePrime(false);

    expect(standaloneProductName()).toBe('Harvester');
  });
});

describe('resolveL10nGlobals', () => {
  it('should replace tokens with their name when no value is given', () => {
    const translations = { support: { title: '[[Harvester]] Support' } };

    resolveL10nGlobals(translations);

    expect(translations).toStrictEqual({ support: { title: 'Harvester Support' } });
  });

  it('should replace every token in a string with the given value', () => {
    const translations = { message: 'The [[Harvester]] UI only supports [[Harvester]] v1.3.0 and later' };

    resolveL10nGlobals(translations, { Harvester: 'SUSE Virtualization' });

    expect(translations.message).toBe('The SUSE Virtualization UI only supports SUSE Virtualization v1.3.0 and later');
  });

  it('should keep an escaped token as a literal', () => {
    const translations = { message: 'Use \\[[Harvester]] in a string' };

    resolveL10nGlobals(translations);

    expect(translations.message).toBe('Use [[Harvester]] in a string');
  });

  it('should leave strings without tokens and non-string values untouched', () => {
    const translations = {
      plain:  'harvester-seeder is an add-on',
      count:  3,
      nested: { link: '<a href="https://harvesterhci.io/">site</a>' },
    };

    resolveL10nGlobals(translations);

    expect(translations).toStrictEqual({
      plain:  'harvester-seeder is an add-on',
      count:  3,
      nested: { link: '<a href="https://harvesterhci.io/">site</a>' },
    });
  });

  it('should leave no token in the extension translations', () => {
    const translations = load(fs.readFileSync(path.join(__dirname, '../../l10n/en-us.yaml'), 'utf8'));

    expect(JSON.stringify(translations)).toContain('[[Harvester]]');

    resolveL10nGlobals(translations);

    expect(JSON.stringify(translations)).not.toContain('[[');
  });
});
