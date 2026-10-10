// Every language's text, one file per area of the app. Keys are "area.key";
// each area's file holds the part after the dot.
import type { Locale } from "../config";

import enAuth from "./en/auth.json";
import enBanks from "./en/banks.json";
import enBills from "./en/bills.json";
import enCommon from "./en/common.json";
import enConnect from "./en/connect.json";
import enData from "./en/data.json";
import enHistory from "./en/history.json";
import enHome from "./en/home.json";
import enInsights from "./en/insights.json";
import enLegal from "./en/legal.json";
import enNav from "./en/nav.json";
import enTransfer from "./en/transfer.json";
import hiAuth from "./hi/auth.json";
import hiBanks from "./hi/banks.json";
import hiBills from "./hi/bills.json";
import hiCommon from "./hi/common.json";
import hiConnect from "./hi/connect.json";
import hiData from "./hi/data.json";
import hiHistory from "./hi/history.json";
import hiHome from "./hi/home.json";
import hiInsights from "./hi/insights.json";
import hiLegal from "./hi/legal.json";
import hiNav from "./hi/nav.json";
import hiTransfer from "./hi/transfer.json";

export type Messages = Record<string, string>;

const flatten = (areas: Record<string, Record<string, string>>): Messages =>
  Object.fromEntries(Object.entries(areas).flatMap(([area, entries]) => Object.entries(entries).map(([key, text]) => [`${area}.${key}`, text])));

export const MESSAGES: Record<Locale, Messages> = {
  en: flatten({ common: enCommon, nav: enNav, home: enHome, banks: enBanks, history: enHistory, transfer: enTransfer, connect: enConnect, data: enData, bills: enBills, insights: enInsights, auth: enAuth, legal: enLegal }),
  hi: flatten({ common: hiCommon, nav: hiNav, home: hiHome, banks: hiBanks, history: hiHistory, transfer: hiTransfer, connect: hiConnect, data: hiData, bills: hiBills, insights: hiInsights, auth: hiAuth, legal: hiLegal }),
};
