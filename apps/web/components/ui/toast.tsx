"use client"

import React from "react"
import { toast as sonnerToast } from "sonner"

import type {
  ExternalToast,
} from "sonner"

// Toast variant styles
const toastVariants = {
  default: "",
  destructive:
    "destructive group border-destructive bg-destructive text-destructive-foreground",
}

// Toast function type
type ToastVariant = "default" | "destructive"

interface ToastProps {
  title?: string
  description?: string
  variant?: ToastVariant
  action?:
    | React.ReactNode
    | ((data: { closeToast: () => void; toastId: number | string }) => React.ReactNode)
}

// useToast hook
function useToast() {
  return {
    toast: ({ title, description, variant = "default", action, ...props }: ToastProps & ExternalToast) => {
      return sonnerToast(<Toast title={title} description={description} action={action} />, {
        className: toastVariants[variant],
        ...props,
      })
    },
    dismiss: (toastId?: number | string) => {
      return sonnerToast.dismiss(toastId)
    },
    loading: (message: string, data?: ExternalToast) => {
      return sonnerToast.loading(message, data)
    },
    success: (message: string, data?: ExternalToast) => {
      return sonnerToast.success(message, data)
    },
    error: (message: string, data?: ExternalToast) => {
      return sonnerToast.error(message, data)
    },
    info: (message: string, data?: ExternalToast) => {
      return sonnerToast.info(message, data)
    },
    warning: (message: string, data?: ExternalToast) => {
      return sonnerToast.warning(message, data)
    },
    promise: <T,>(
      promise: Promise<T> | (() => Promise<T>),
      data?: {
        loading?: string | React.ReactNode
        success?: string | ((data: T) => React.ReactNode)
        error?: string | ((error: Error) => React.ReactNode)
        finally?: () => void
      },
      opts?: ExternalToast
    ) => {
      return sonnerToast.promise(promise, { ...data, ...opts })
    },
  }
}

// Toast component
type ToastComponentProps = ToastProps

function Toast({ title, description, action }: ToastComponentProps) {
  const actionElement = typeof action === 'function' ? null : action;
  
  return (
    <div className="grid gap-1">
      {title && <div className="text-sm font-semibold">{title}</div>}
      {description && (
        <div className="text-sm opacity-90">{description}</div>
      )}
      {actionElement}
    </div>
  )
}

export { useToast, Toast }
