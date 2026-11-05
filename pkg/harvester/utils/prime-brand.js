import { BRAND } from '@shell/config/types';

/**
 * Standalone Prime takes the SUSE theme of Rancher Prime: the `ui-brand` setting decides the stylesheet the shell
 * loads, and only the `suse` brand has one. Returns an updater that switches the copy of the setting in the store,
 * the server keeps its value, and puts the server's brand back when the flavor stops being Prime.
 */
export function primeBrandUpdater() {
  let serverBrand;

  return (brandSetting, isPrime) => {
    if (!brandSetting) {
      return;
    }

    if (brandSetting.value !== BRAND.SUSE) {
      serverBrand = brandSetting.value;
    }

    const brand = isPrime ? BRAND.SUSE : (serverBrand ?? brandSetting.value);

    if (brandSetting.value !== brand) {
      brandSetting.value = brand;
    }
  };
}
