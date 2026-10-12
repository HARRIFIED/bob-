import { useEffect } from 'react';
import { FieldGuide } from '../components/learning/FieldGuide';
import { LandingExperience } from '../components/onboarding/LandingExperience';
import { MissionBrief } from '../components/onboarding/MissionBrief';
import { SimulatorWorkspace } from '../components/simulator/SimulatorWorkspace';
import { SimulatorProvider, useSimulator } from '../store/simulator-store';
function Screens() {
  const { screen } = useSimulator();
  useEffect(() => { window.scrollTo(0, 0); const heading = document.querySelector('h1'); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true }); }, [screen]);
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {screen === 'entry' ? <LandingExperience /> : screen === 'brief' ? <MissionBrief /> : <SimulatorWorkspace />}
    <FieldGuide />
  </>;
}
export default function App() { return <SimulatorProvider><Screens /></SimulatorProvider>; }
