import commonEnUs from "../locales/en-US/common.json";
import hostsEnUs from "../locales/en-US/hosts.json";
import commonZhCn from "../locales/zh-CN/common.json";
import hostsZhCn from "../locales/zh-CN/hosts.json";

export const resources = {
  "en-US": {
    common: commonEnUs,
    hosts: hostsEnUs,
  },
  "zh-CN": {
    common: commonZhCn,
    hosts: hostsZhCn,
  },
} as const;
