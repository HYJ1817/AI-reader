"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { appUpdate, type UpdateProtection } from "@/lib/appUpdate";

export default function useUpdateProtection(protection: UpdateProtection) {
  const [key] = useState(() => Symbol("update-protection"));
  useLayoutEffect(() => { appUpdate.protect(key, protection); });
  useEffect(() => () => appUpdate.unprotect(key), [key]);
}
