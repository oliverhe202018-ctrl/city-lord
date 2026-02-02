"use client"

import { createContext, useContext, useEffect, useState } from "react"

interface MapContextType {
  map: any | null
  AMap: any | null
  viewMode: 'individual' | 'faction'
  setViewMode: (mode: 'individual' | 'faction') => void
}

const MapContext = createContext<MapContextType>({ 
  map: null, 
  AMap: null, 
  viewMode: 'individual',
  setViewMode: () => {} 
})

export const useMap = () => useContext(MapContext)

export const MapProvider = ({
  map,
  AMap,
  children,
}: {
  map: any
  AMap: any
  children: React.ReactNode
}) => {
  const [viewMode, setViewMode] = useState<'individual' | 'faction'>('individual')

  return <MapContext.Provider value={{ map, AMap, viewMode, setViewMode }}>{children}</MapContext.Provider>
}
