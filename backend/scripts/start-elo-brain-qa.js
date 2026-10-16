import { createEloBrainQaApp } from '../src/elo-brain-qa.js';
createEloBrainQaApp().listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('ELO Brain QA ready; inference only; canonical history unchanged.');
});
