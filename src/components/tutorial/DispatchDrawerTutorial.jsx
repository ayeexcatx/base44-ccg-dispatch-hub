import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CircleHelp } from 'lucide-react';
import TutorialOverlay from './TutorialOverlay';
import {
  DISPATCH_DRAWER_TUTORIAL_COMPLETED_KEY,
  DISPATCH_DRAWER_TUTORIAL_SEEN_KEY,
  dispatchDrawerTutorialSteps,
} from './tutorialConfig';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getVisibleRect = (selector) => {
  if (!selector) return null;
  const targets = Array.from(document.querySelectorAll(selector));
  const visible = targets.find((el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  });
  return visible?.getBoundingClientRect() || null;
};

export default function DispatchDrawerTutorial({ isOwner, drawerOpen }) {
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const totalSteps = dispatchDrawerTutorialSteps.length;
  const isCompletion = isRunning && stepIndex >= totalSteps;
  const currentStep = !isCompletion ? dispatchDrawerTutorialSteps[stepIndex] : null;

  const stopTutorial = useCallback(() => {
    setIsRunning(false);
    setTargetRect(null);
  }, []);

  const startTutorial = useCallback(() => {
    if (!isOwner || !drawerOpen) return;
    localStorage.setItem(DISPATCH_DRAWER_TUTORIAL_SEEN_KEY, 'true');
    setStepIndex(0);
    setIsRunning(true);
  }, [drawerOpen, isOwner]);

  const handleFinish = useCallback(() => {
    localStorage.setItem(DISPATCH_DRAWER_TUTORIAL_COMPLETED_KEY, 'true');
    stopTutorial();
  }, [stopTutorial]);

  const handleStepChange = useCallback((nextIndex) => {
    setStepIndex(clamp(nextIndex, 0, totalSteps));
  }, [totalSteps]);

  const goToNextStep = useCallback(() => {
    if (isCompletion) {
      handleFinish();
      return;
    }
    handleStepChange(stepIndex + 1);
  }, [handleFinish, handleStepChange, isCompletion, stepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (isCompletion) {
      handleStepChange(totalSteps - 1);
      return;
    }
    handleStepChange(stepIndex - 1);
  }, [handleStepChange, isCompletion, stepIndex, totalSteps]);

  useEffect(() => {
    if (!isOwner || !drawerOpen || isRunning) return;
    const seen = localStorage.getItem(DISPATCH_DRAWER_TUTORIAL_SEEN_KEY) === 'true';
    if (!seen) {
      startTutorial();
    }
  }, [drawerOpen, isOwner, isRunning, startTutorial]);

  useEffect(() => {
    if (!drawerOpen) {
      stopTutorial();
    }
  }, [drawerOpen, stopTutorial]);

  useEffect(() => {
    if (!isRunning || isCompletion || !currentStep) return;

    let cancelled = false;
    let attempts = 0;

    const resolveTarget = () => {
      if (cancelled) return;
      const rect = getVisibleRect(currentStep.target);
      if (rect) {
        setTargetRect(rect);
        return;
      }

      attempts += 1;
      if (attempts >= 8) {
        handleStepChange(stepIndex + 1);
        return;
      }

      window.setTimeout(resolveTarget, 120);
    };

    window.setTimeout(resolveTarget, 80);

    return () => {
      cancelled = true;
    };
  }, [currentStep, handleStepChange, isCompletion, isRunning, stepIndex]);

  useEffect(() => {
    if (!isRunning || isCompletion) return;

    const updatePosition = () => {
      const rect = getVisibleRect(currentStep?.target);
      if (rect) setTargetRect(rect);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [currentStep?.target, isCompletion, isRunning]);

  const tooltipStyle = useMemo(() => {
    if (isCompletion || !targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const margin = 16;
    const top = clamp(targetRect.bottom + 14, margin, window.innerHeight - 260);
    const left = clamp(targetRect.left, margin, window.innerWidth - 400);
    return { top: `${top}px`, left: `${left}px` };
  }, [isCompletion, targetRect]);

  return (
    <>
      {isOwner && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={startTutorial}
          className="h-7 text-xs"
          data-tour="dispatch-tutorial-trigger"
        >
          <CircleHelp className="mr-1 h-3.5 w-3.5" />
          Tutorial
        </Button>
      )}

      <TutorialOverlay
        active={isRunning}
        targetRect={targetRect}
        tooltipStyle={tooltipStyle}
        step={isCompletion
          ? {
            title: 'Dispatch Tutorial Complete',
            description: 'You can replay this tutorial anytime using the Tutorial button in the dispatch drawer.',
          }
          : currentStep}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isCompletion={isCompletion}
        onBack={goToPreviousStep}
        onNext={goToNextStep}
        onSkip={stopTutorial}
        onFinish={handleFinish}
        onReplay={startTutorial}
      />
    </>
  );
}
