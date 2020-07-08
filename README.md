# Redux Recoiled

**A [recoil-esque](https://github.com/facebookexperimental/Recoil) wrapper for [react-redux](https://github.com/reduxjs/react-redux)**

This project brings the wonderfully simple API of **Recoil** to **React-Redux**. It provides state management that uses "atoms" and selectors, while maintaining the ability to interact with the store outside of a component.

Other benefits include:

- Atoms can be inspected via the Redux devtools extension
- Atoms and selectors that return the same value between state changes, will not cause a re-render.
