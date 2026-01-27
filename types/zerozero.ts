export type JourneyKey =
  | 'energy'
  | 'travel'
  | 'food'
  | 'shopping'
  | 'money'
  | 'carbon'
  | 'tech'
  | 'waste'
  | 'holidays';

export type JourneyState = 'not_started' | 'in_progress' | 'completed';

export type ImpactBand = 'low' | 'medium' | 'high';
export type EffortBand = 'low' | 'medium' | 'high';

export type CardType = 'cheapest' | 'greenest' | 'balance' | 'tip';

export interface User {
  id: string;
  name?: string;
  postcode?: string;
  household?: string;
  home_type?: string;
  transport_baseline?: string;
}

export interface Journey {
  journey_key: JourneyKey;
  state: JourneyState;
}

export interface JourneyAnswer {
  journey_key: JourneyKey;
  question_key: string;
  answer: string; // one word or '?'
}

export interface Card {
  id: string;
  journey_key?: JourneyKey;
  type: CardType;
  title: string;
  description?: string;
  impact_band: ImpactBand;
  effort_band: EffortBand;
}

export interface SpaceItem {
  type: 'journey' | 'card' | 'tip';
  id: string;
  variant: 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked';
  data: any;
}
