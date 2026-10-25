import commonEnUs from "../locales/en-US/common.json";
import hostsEnUs from "../locales/en-US/hosts.json";
import issuesEnUs from "../locales/en-US/issues.json";
import notesEnUs from "../locales/en-US/notes.json";
import sessionsEnUs from "../locales/en-US/sessions.json";
import commonZhCn from "../locales/zh-CN/common.json";
import hostsZhCn from "../locales/zh-CN/hosts.json";
import issuesZhCn from "../locales/zh-CN/issues.json";
import notesZhCn from "../locales/zh-CN/notes.json";
import sessionsZhCn from "../locales/zh-CN/sessions.json";

export const resources = {
  "en-US": {
    common: commonEnUs,
    hosts: hostsEnUs,
    issues: issuesEnUs,
    notes: notesEnUs,
    sessions: sessionsEnUs,
  },
  "zh-CN": {
    common: commonZhCn,
    hosts: hostsZhCn,
    issues: issuesZhCn,
    notes: notesZhCn,
    sessions: sessionsZhCn,
  },
} as const;
