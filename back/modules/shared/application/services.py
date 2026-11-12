class CrudService:
    def __init__(self, repository):
        self.repository = repository

    def save(self, entity):
        return self.repository.save(entity)
