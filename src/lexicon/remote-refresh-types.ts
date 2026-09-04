export type RefreshLexiconReplacementsResult = {
  ok: boolean;
  ruleCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type RefreshBoundaryExceptionsResult = {
  ok: boolean;
  phraseCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type RefreshAmbiguousFormChoicesResult = {
  ok: boolean;
  choiceCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type RefreshSpellWordListResult = {
  ok: boolean;
  wordCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type RefreshSpellDictionaryResult = {
  ok: boolean;
  entryCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};
