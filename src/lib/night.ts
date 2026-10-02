// Ночь на сцене (главная, комната): вещи могут светиться — от шляпы грибника летят споры.
// Экран со сценой оборачивает её в NightContext.Provider; везде ещё (гардероб, плитки) — день.
import { createContext, useContext } from 'react';

export const NightContext = createContext(false);
export const useNight = () => useContext(NightContext);
