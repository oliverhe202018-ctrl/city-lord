"use client"

import { createContext, useContext, useEffect, useState } from "react"

interface MapContextType {
  map: any | null
  AMap: any | null
}

const MapContext = createContext<MapContextType>({ map: null, AMap: null })

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
  return <MapContext.Provider value={{ map, AMap }}>{children}</MapContext.Provider>
}
