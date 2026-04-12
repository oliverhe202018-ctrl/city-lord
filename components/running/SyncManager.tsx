"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { saveRunActivity } from "@/app/actions/run-service"
import { useGameStore } from "@/store/useGameStore"
import { lineString as turfLineString, simplify as turfSimplify } from '@turf/turf'

const PENDING_KEY = 'PENDING_RUN_UPLOAD'

export function SyncManager() {
  // SyncManager is entirely disabled to prevent phantom ghost sumissions 
  // overriding new runs. It now safely acts as a dummy headless component.
  return null;
}
