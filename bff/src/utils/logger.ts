export interface LogData {
  [key: string]: any
}

class Logger {
  private formatMessage(level: string, data: LogData): string {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      ...data
    }
    return JSON.stringify(logEntry)
  }

  info(data: LogData): void {
    console.log(this.formatMessage('INFO', data))
  }

  error(data: LogData): void {
    console.error(this.formatMessage('ERROR', data))
  }

  warn(data: LogData): void {
    console.warn(this.formatMessage('WARN', data))
  }

  debug(data: LogData): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', data))
    }
  }
}

export const logger = new Logger()