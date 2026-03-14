import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

const OwnerTutorialContext = createContext({
  restartTutorial: () => {},
});

const STORAGE_KEYS = {
  dismissed: 'ownerTutorialDemoDismissed',
  completed: 'ownerTutorialDemoCompleted',
};

const STEPS = {
  welcome: 'welcome',
  home: 'home',
  dispatches: 'dispatches',
};

function TutorialCard({ title, body, children, centered = false }) {
  return (
    <div
      className={`fixed z-[75] w-[min(92vw,24rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl ${
        centered ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : ''
      }`}
    >
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function OwnerTutorialOverlay({ step, onStart, onSkipWelcome, onDisableWelcome, onBack, onNext, onSkipTour, onFinish }) {
  const location = useLocation();
  const targetRectRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 80, left: 16 });

  const targetSelector =
    step === STEPS.home
      ? '[data-tour="home-overview"]'
      : step === STEPS.dispatches
        ? '[data-tour="dispatches-overview"]'
        : null;

  const updatePosition = useCallback(() => {
    if (!targetSelector) return;
    const element = document.querySelector(targetSelector);
    if (!element) {
      targetRectRef.current = null;
      setTooltipPosition({ top: 80, left: 16 });
      return;
    }

    const rect = element.getBoundingClientRect();
    targetRectRef.current = rect;

    const gap = 12;
    const tooltipWidth = Math.min(window.innerWidth * 0.92, 384);
    const preferredLeft = rect.left;
    const maxLeft = Math.max(16, window.innerWidth - tooltipWidth - 16);
    const left = Math.min(Math.max(16, preferredLeft), maxLeft);

    let top = rect.bottom + gap;
    if (top + 220 > window.innerHeight) {
      top = Math.max(16, rect.top - 220 - gap);
    }

    setTooltipPosition({ top, left });
  }, [targetSelector]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition, location.pathname]);

  if (step === STEPS.welcome) {
    return (
      <>
        <div className="fixed inset-0 z-[70] bg-slate-950/55" />
        <TutorialCard
          centered
          title="Welcome to CCG Dispatch Hub"
          body="This quick tour will show you the most important parts of your portal so you can get started faster."
        >
          <Button size="sm" onClick={onStart}>Start Tour</Button>
          <Button variant="secondary" size="sm" onClick={onSkipWelcome}>Skip for Now</Button>
          <Button variant="ghost" size="sm" onClick={onDisableWelcome}>Don't show again</Button>
        </TutorialCard>
      </>
    );
  }

  if (step !== STEPS.home && step !== STEPS.dispatches) return null;

  const targetRect = targetRectRef.current;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-950/45" />
      {targetRect && (
        <div
          className="pointer-events-none fixed z-[65] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]"
          style={{
            top: Math.max(0, targetRect.top - 6),
            left: Math.max(0, targetRect.left - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <div className="fixed z-[75]" style={{ top: tooltipPosition.top, left: tooltipPosition.left }}>
        {step === STEPS.home ? (
          <TutorialCard
            title="Home Page"
            body="This is your starting point for announcements, action-needed items, and dispatch activity."
          >
            <Button variant="secondary" size="sm" onClick={onBack}>Back</Button>
            <Button size="sm" onClick={onNext}>Next</Button>
            <Button variant="ghost" size="sm" onClick={onSkipTour}>Skip Tour</Button>
          </TutorialCard>
        ) : (
          <TutorialCard
            title="Dispatches"
            body="This is where you can view dispatches, open dispatch details, and manage assignments."
          >
            <Button variant="secondary" size="sm" onClick={onBack}>Back</Button>
            <Button size="sm" onClick={onFinish}>Finish</Button>
          </TutorialCard>
        )}
      </div>
    </>
  );
}

export function OwnerTutorialProvider({ isCompanyOwner, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(null);

  const closeTutorial = useCallback(() => {
    setStep(null);
  }, []);

  useEffect(() => {
    if (!isCompanyOwner) {
      setStep(null);
      return;
    }

    const dismissed = window.localStorage.getItem(STORAGE_KEYS.dismissed) === 'true';
    const completed = window.localStorage.getItem(STORAGE_KEYS.completed) === 'true';

    if (!dismissed && !completed) {
      setStep((current) => current ?? STEPS.welcome);
    }
  }, [isCompanyOwner]);

  const goToHomeStep = useCallback(() => {
    if (location.pathname !== createPageUrl('Home')) {
      navigate(createPageUrl('Home'));
    }
    setStep(STEPS.home);
  }, [location.pathname, navigate]);

  const goToDispatchesStep = useCallback(() => {
    if (location.pathname !== createPageUrl('Portal')) {
      navigate(createPageUrl('Portal'));
    }
    setStep(STEPS.dispatches);
  }, [location.pathname, navigate]);

  const restartTutorial = useCallback(() => {
    if (!isCompanyOwner) return;
    window.localStorage.removeItem(STORAGE_KEYS.dismissed);
    window.localStorage.removeItem(STORAGE_KEYS.completed);
    setStep(STEPS.welcome);
  }, [isCompanyOwner]);

  const disableAutoOpen = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEYS.dismissed, 'true');
    closeTutorial();
  }, [closeTutorial]);

  const finishTutorial = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEYS.completed, 'true');
    closeTutorial();
  }, [closeTutorial]);

  const contextValue = useMemo(() => ({ restartTutorial }), [restartTutorial]);

  return (
    <OwnerTutorialContext.Provider value={contextValue}>
      {children}
      {isCompanyOwner && (
        <OwnerTutorialOverlay
          step={step}
          onStart={goToHomeStep}
          onSkipWelcome={closeTutorial}
          onDisableWelcome={disableAutoOpen}
          onBack={step === STEPS.dispatches ? goToHomeStep : () => setStep(STEPS.welcome)}
          onNext={goToDispatchesStep}
          onSkipTour={closeTutorial}
          onFinish={finishTutorial}
        />
      )}
    </OwnerTutorialContext.Provider>
  );
}

export function useOwnerTutorial() {
  return useContext(OwnerTutorialContext);
}
