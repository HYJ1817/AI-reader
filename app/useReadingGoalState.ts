"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_READING_TARGET_MINUTES,
  loadReadingGoal,
} from "@/lib/readingGoal";

export default function useReadingGoalState() {
  const [readingGoal, setReadingGoal] = useState({
    targetMinutes: DEFAULT_READING_TARGET_MINUTES,
  });
  const [goalInputValue, setGoalInputValue] = useState(
    DEFAULT_READING_TARGET_MINUTES
  );

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedGoal = loadReadingGoal();
      setReadingGoal(storedGoal);
      setGoalInputValue(storedGoal.targetMinutes);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  return {
    readingGoal,
    setReadingGoal,
    goalInputValue,
    setGoalInputValue,
  };
}
