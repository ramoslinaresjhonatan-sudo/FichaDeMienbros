from datetime import date, datetime, timedelta
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path


class DailyAuditHandler(TimedRotatingFileHandler):
    """Retiene el archivo actual y hasta 59 días naturales de registros rotados."""
    def getFilesToDelete(self):
        files = set(super().getFilesToDelete())
        base = Path(self.baseFilename)
        cutoff = date.today() - timedelta(days=59)
        for path in base.parent.glob(base.name + '.????-??-??'):
            try:
                file_date = datetime.strptime(path.name[-10:], '%Y-%m-%d').date()
            except ValueError:
                continue
            if file_date < cutoff:
                files.add(str(path))
        return sorted(files)
