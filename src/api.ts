import { createStore, Reducer as ReduxReducer } from 'redux';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';

/** A map of store keys to their reducer functions */
const reducerMap = {} as Record<string, Reducer<any>>;

/** Creates an instance of state by utilizing the reducer map */
const generateState = (state: any | undefined, action: Action<any>) =>
  Object.entries(reducerMap).reduce((acc, [key, reducer]) => {
    acc[key] = reducer(state[key], action);
    return acc;
  }, {} as Record<string, any>);

export const store = createStore(
  (state: any | undefined, action: Action<any>) => generateState(state, action),
  (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__()
);

//******************
//.... Redux-Recoiled API ....
//*****************************

/** Symbol used to delimit family keys from member IDs */
const KEY_DELIMITER = '::';

/** Creates a piece of Redux state */
export const xAtom = <S extends any>({ key, initialState }: xAtomProps<S>): ReduxState<S> => {
  const reducer: Reducer<S> = (state = initialState, action) => {
    if (action.type === key) {
      return action.state;
    }
    return state;
  };

  const selector = (state: any) => (state[key] === undefined ? initialState : state[key]);

  const useGet = () => useSelector(selector);

  /** Returns a function that can set an xAtom with a value or a setter callback */
  const useSet: SetHook<S> = () => {
    const dispatch = useDispatch();

    return stateOrSetter => {
      if (stateOrSetter instanceof Function) {
        // Get the current state at the moment the component calls the set function
        const currentState = selector(store.getState());
        dispatch({ type: key, state: stateOrSetter(currentState) });
      } else {
        dispatch({ type: key, state: stateOrSetter });
      }
    };
  };

  reducerMap[key] = reducer;

  return { key, useGet: useGet, useSet: useSet, selector };
};

type xAtomProps<S> = { key: string; initialState: S };

function _xSelector<S extends any>(opts: xSelectorPropsWritable<S>): ReduxState<S>;
function _xSelector<S extends any>(opts: xSelectorPropsReadOnly<S>): ReduxValueReadOnly<S>;
function _xSelector<S extends any>(opts: xSelectorProps<S>) {
  const memberID = opts.key.split(KEY_DELIMITER)[1];

  const selector: Selector<S> = (state: any) => {
    const get: GetRecoilValue = xValue => xValue.selector(state);
    return opts.getter({ get, memberID });
  };

  const useGet: GetHook<S> = () => useSelector(selector);

  if ('setter' in opts) {
    const set: SetRecoilValue = (xState, valOrUpdater) => {
      if (valOrUpdater instanceof Function) {
        const current = xState.selector(store.getState());
        store.dispatch({ type: opts.key, state: valOrUpdater(current) });
      } else {
        store.dispatch({ type: opts.key, state: valOrUpdater });
      }
    };

    const useSet = () => (valOrUpdater: ValOrUpdater<S>) => {
      let newVal: S;
      if (valOrUpdater instanceof Function) {
        const current = selector(store.getState());
        newVal = valOrUpdater(current);
      } else {
        newVal = valOrUpdater;
      }
      opts.setter({ set, newVal, memberID });
    };
    return { key: opts.key, useGet, useSet, selector };
  } else {
    return { key: opts.key, useGet, selector };
  }
}
/** Derives a computed value from 1 or more xAtoms.
 * May also be used to set multiple atoms from a single value.
 * Components will only re-render due to changes in the computed result, not the xAtoms.
 */
export const xSelector = _xSelector;

type GetHook<S> = () => S;
type SetHook<S> = () => SetterOrUpdater<S>;

type Selector<S> = (state: any) => S;

type Getter<S> = (p: { get: GetRecoilValue; memberID: string | undefined }) => S;
type Setter = (p: { set: SetRecoilValue; newVal: any; memberID: string | undefined }) => void;

type xSelectorPropsWritable<S> = { key: string; getter: Getter<S>; setter: Setter };
type xSelectorPropsReadOnly<S> = { key: string; getter: Getter<S> };
type xSelectorProps<S> = xSelectorPropsWritable<S> | xSelectorPropsReadOnly<S>;

const nullSelector = <T extends any>() =>
  xSelector({ key: '', getter: () => (null as unknown) as T, setter: () => null });

/** Allows for grouping of xAtoms */
export const xAtomFamily = <S extends unknown>({ key, initialState }: xAtomProps<S>) => (id: string): ReduxState<S> => {
  if (!id) {
    return nullSelector();
  }
  return xAtom({ key: `${key}${KEY_DELIMITER}${id}`, initialState });
};

function _xSelectorFamily<S extends any>(opts: xSelectorPropsWritable<S>): (id: string) => ReduxState<S>;
function _xSelectorFamily<S extends any>(opts: xSelectorPropsReadOnly<S>): (id: string) => ReduxValueReadOnly<S>;
function _xSelectorFamily<S extends any>(opts: xSelectorProps<S>) {
  return (id: string) => {
    if ('setter' in opts) {
      return xSelector({ key: `${opts.key}${KEY_DELIMITER}${id}`, getter: opts.getter, setter: opts.setter });
    }
    return xSelector({ key: `${opts.key}${KEY_DELIMITER}${id}`, getter: opts.getter });
  };
}

/** Allows for grouping of xSelectors */
export const xSelectorFamily = _xSelectorFamily;

/** Returns the value of an xAtom and subscribes component to future updates */
export const useReduxValue: GetRecoilValue = xValue => {
  return xValue.useGet();
};

/** Returns a setter for an xAtom */
export const useSetReduxState = <S extends any>(xState: ReduxState<S>) => {
  return xState.useSet();
};

/** Returns a tuple where the 1st element is the xAtom's value and the 2nd is a setter.
 * Subscribes component to future updates
 */
export const useReduxState = <S extends any>(xState: ReduxState<S>) => {
  return [xState.useGet(), xState.useSet()] as const;
};

export const useRemoveReduxState = <S extends any>(atom: ReduxState<S>) => {
  const dispatch = useDispatch();
  delete reducerMap[atom.key];
  dispatch(actions.REFRESH);
};

/** Provides the callback with access to execute xAtom actions at any point in time */
export const useReduxCallback = (() => {
  const getOnce: GetRecoilValue = xValue => xValue.selector(store.getState());

  const set: SetRecoilValue = (xState, valorUpdater) => {
    if (valorUpdater instanceof Function) {
      const current = xState.selector(store.getState());
      store.dispatch({ type: xState.key, state: valorUpdater(current) });
    } else {
      store.dispatch({ type: xState.key, state: valorUpdater });
    }
  };

  const remove = (xValue: ReduxValue<any>) => {
    delete reducerMap[xValue.key];
    store.dispatch(actions.REFRESH);
  };

  const callbackProps = { getOnce, set, remove };

  type CbProps = typeof callbackProps;

  return (callback: (props: CbProps) => void | (() => void), deps: any[]) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => callback(callbackProps), [...deps, callback]);
  };
})();

//**********************
//.... Internal Redux Actions ....
//*********************************

const actions = {
  /** Refresh the store to reflect changes in the reducer map */
  REFRESH: { type: '@REFRESH', state: null },
} as const;

//**************
//.... General Types ....
//*************************

type ReduxState<S> = {
  key: string;
  useGet: () => S;
  useSet: () => SetterOrUpdater<S>;
  selector: (state: any) => S;
};

type ReduxValueReadOnly<S> = {
  key: string;
  useGet: () => S;
  selector: (state: any) => S;
};

type ReduxValue<S> = ReduxValueReadOnly<S> | ReduxState<S>;

type Reducer<S> = ReduxReducer<S | undefined, Action<S>>;

type Action<S> = { type: string; state: S };

type ValOrUpdater<S> = S | ((current: S) => S);

type SetterOrUpdater<S> = (valOrUpdater: ValOrUpdater<S>) => void;

type SetRecoilValue = <S extends any>(xState: ReduxState<S>, valOrUpdater: ValOrUpdater<S>) => void;

type GetRecoilValue = <S extends any>(xValue: ReduxValue<S>) => S;
